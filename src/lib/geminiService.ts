import type { ContextFirewallPolicy, PrivacyXRayReceipt } from '../types';
import { getFirewallPolicy, recordPrivacyReceipt } from './firewallService';

export interface GenerateReflectionInput {
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  firewallPolicy?: Partial<ContextFirewallPolicy>;
}

export interface AIReflectionResult {
  summary: string;
  insights: string[];
  questions: string[];
  suggestedTags: string[];
  privacyReceipt?: PrivacyXRayReceipt;
}

export class ReflectionError extends Error {
  isUserFacing: boolean;
  isUserContentShort: boolean;

  constructor(message: string, isUserFacing = true, isUserContentShort = false) {
    super(message);
    this.name = 'ReflectionError';
    this.isUserFacing = isUserFacing;
    this.isUserContentShort = isUserContentShort;
  }
}

/**
 * Calls the secure server-side Gemini reflection endpoint with the user's authenticated ID token
 * and active Context Firewall policy.
 */
export async function generateJournalReflection(
  input: GenerateReflectionInput,
  idToken?: string | null
): Promise<AIReflectionResult> {
  const content = (input.content || '').trim();

  // Validate locally before dispatching to server
  if (!content || content.length < 15) {
    throw new ReflectionError(
      'Write a little more before asking Gemini to reflect.',
      true,
      true
    );
  }

  if (!idToken) {
    throw new ReflectionError(
      'Authentication is required to use Gemini reflection.',
      true,
      false
    );
  }

  const activePolicy = {
    ...getFirewallPolicy(),
    ...(input.firewallPolicy || {})
  };

  try {
    const response = await fetch('/api/ai/reflect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        title: input.title || 'Untitled',
        content: content,
        mood: input.mood || '',
        tags: input.tags || [],
        firewallPolicy: activePolicy
      })
    });

    if (!response.ok) {
      let errorMessage = 'Gemini reflection is temporarily unavailable.';
      try {
        const errorData = await response.json();
        if (response.status === 400 && typeof errorData.error === 'string' && errorData.error.includes('short')) {
          throw new ReflectionError('Write a little more before asking Gemini to reflect.', true, true);
        }
        if (response.status === 401) {
          throw new ReflectionError('Please sign in with Google to use Gemini reflection.', true);
        }
        if (response.status === 403) {
          throw new ReflectionError(errorData.error || 'Context Firewall blocked this reflection request.', true);
        }
        if (response.status === 429) {
          throw new ReflectionError('Too many reflection requests. Please wait a moment.', true);
        }
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
      } catch (parseErr) {
        if (parseErr instanceof ReflectionError) {
          throw parseErr;
        }
      }

      throw new ReflectionError(errorMessage, true);
    }

    const data = await response.json();

    // Validate structured response shape
    const summary = typeof data.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : 'Thank you for capturing your reflections.';

    const insights = Array.isArray(data.insights)
      ? data.insights.filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
      : [];

    const questions = Array.isArray(data.questions)
      ? data.questions.filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
      : [];

    const suggestedTags = Array.isArray(data.suggestedTags)
      ? data.suggestedTags
          .filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
          .map((t: string) => t.trim().replace(/^#/, '').toLowerCase())
          .slice(0, 5)
      : [];

    if (data.privacyReceipt) {
      recordPrivacyReceipt(data.privacyReceipt);
    }

    return {
      summary,
      insights,
      questions,
      suggestedTags,
      privacyReceipt: data.privacyReceipt
    };
  } catch (err: unknown) {
    if (err instanceof ReflectionError) {
      throw err;
    }
    console.error('Reflection request error:', err);
    throw new ReflectionError(
      'Gemini reflection is temporarily unavailable. Your journal entry is safe. You can try again.',
      true
    );
  }
}
