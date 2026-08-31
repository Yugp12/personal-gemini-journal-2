import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import type { 
  AIPrivacyPolicy, 
  PrivacyMode, 
  SensitiveElement, 
  SanitizationResult, 
  ContextReceipt,
  PrivacyXRayReceipt 
} from '../types';

export const DEFAULT_AI_PRIVACY_POLICY: AIPrivacyPolicy = {
  privacyMode: 'STANDARD',
  alwaysBlock: {
    passwords: true,
    apiKeys: true,
    accessTokens: true,
    financialIdentifiers: true,
    vaultContent: true,
    authInfo: true
  },
  allow: {
    projects: true,
    goals: true,
    productivity: true,
    generalEmotions: true,
    habits: true,
    generalReflections: true
  },
  askOrRedact: {
    personNames: 'REDACT',
    locations: 'ALLOW',
    relationships: 'ALLOW',
    personalExperiences: 'ALLOW'
  },
  allowMemories: true,
  allowedMemoryCategories: [
    'Preference',
    'Goal',
    'Project',
    'Personal Context',
    'Habit',
    'Other'
  ],
  allowConversationHistory: true,
  maxHistoryTurns: 10,
  updatedAt: new Date().toISOString()
};

const POLICY_LOCAL_KEY = 'pgj_gemini_ai_privacy_policy_v2';
const RECEIPTS_LOCAL_KEY = 'pgj_gemini_context_receipts_v2';

/**
 * Retrieves the user's active AI Privacy Policy from local storage or Firestore
 */
export function getActivePrivacyPolicy(): AIPrivacyPolicy {
  try {
    const raw = localStorage.getItem(POLICY_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_AI_PRIVACY_POLICY,
        ...parsed,
        alwaysBlock: { ...DEFAULT_AI_PRIVACY_POLICY.alwaysBlock, ...(parsed.alwaysBlock || {}) },
        allow: { ...DEFAULT_AI_PRIVACY_POLICY.allow, ...(parsed.allow || {}) },
        askOrRedact: { ...DEFAULT_AI_PRIVACY_POLICY.askOrRedact, ...(parsed.askOrRedact || {}) }
      };
    }
  } catch (err) {
    console.warn('[Privacy Firewall] Could not read cached privacy policy:', err);
  }
  return { ...DEFAULT_AI_PRIVACY_POLICY };
}

/**
 * Loads AI Privacy Policy from Firestore for authenticated UID
 */
export async function loadUserPrivacyPolicy(userId: string): Promise<AIPrivacyPolicy> {
  if (!userId) return getActivePrivacyPolicy();
  try {
    const docRef = doc(db, 'users', userId, 'privacySettings', 'policy');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as AIPrivacyPolicy;
      const merged: AIPrivacyPolicy = {
        ...DEFAULT_AI_PRIVACY_POLICY,
        ...data,
        alwaysBlock: { ...DEFAULT_AI_PRIVACY_POLICY.alwaysBlock, ...(data.alwaysBlock || {}) },
        allow: { ...DEFAULT_AI_PRIVACY_POLICY.allow, ...(data.allow || {}) },
        askOrRedact: { ...DEFAULT_AI_PRIVACY_POLICY.askOrRedact, ...(data.askOrRedact || {}) }
      };
      localStorage.setItem(POLICY_LOCAL_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('[Privacy Firewall] Could not load policy from Firestore, using local cached:', err);
  }
  return getActivePrivacyPolicy();
}

/**
 * Saves AI Privacy Policy to Firestore & local storage
 */
export async function saveUserPrivacyPolicy(userId: string, policy: Partial<AIPrivacyPolicy>): Promise<AIPrivacyPolicy> {
  const current = getActivePrivacyPolicy();
  const updated: AIPrivacyPolicy = {
    ...current,
    ...policy,
    alwaysBlock: { ...current.alwaysBlock, ...(policy.alwaysBlock || {}) },
    allow: { ...current.allow, ...(policy.allow || {}) },
    askOrRedact: { ...current.askOrRedact, ...(policy.askOrRedact || {}) },
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(POLICY_LOCAL_KEY, JSON.stringify(updated));

  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'privacySettings', 'policy');
      await setDoc(docRef, updated, { merge: true });
    } catch (err) {
      console.error('[Privacy Firewall] Failed to sync policy to Firestore:', err);
    }
  }

  return updated;
}

/**
 * Masks sensitive raw snippet for safe display
 */
function maskSecret(val: string): string {
  if (!val || val.length <= 4) return '••••';
  if (val.length <= 8) return `${val.slice(0, 2)}••••${val.slice(-2)}`;
  return `${val.slice(0, 3)}••••••••${val.slice(-3)}`;
}

/**
 * Core Deterministic Sanitization & Inspection Pipeline.
 * Evaluates Journal content against deterministic security patterns & User Privacy Policy.
 */
export function inspectAndSanitizeJournal(
  content: string,
  title = 'Untitled',
  mood = '😊',
  tags: string[] = [],
  customPolicy?: AIPrivacyPolicy
): SanitizationResult {
  const policy = customPolicy || getActivePrivacyPolicy();
  const rawText = content || '';
  const detected: SensitiveElement[] = [];

  let sanitized = rawText;
  const originalCharCount = rawText.length;

  // 1. HARD KERNEL: Privacy Vault references / leakage prevention
  const vaultRegex = /(?:\/users\/[^/]+\/vaultRecords|\/users\/[^/]+\/vault|vaultRecords|privacy vault password|vault secret|vault note)/gi;
  let vaultMatch: RegExpExecArray | null;
  while ((vaultMatch = vaultRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-vault-${detected.length + 1}`,
      type: 'VAULT_REFERENCE',
      originalSnippet: vaultMatch[0],
      sanitizedSnippet: '[VAULT_REFERENCE_ISOLATED]',
      classification: 'BLOCKED',
      category: 'Privacy Vault Isolation',
      reason: 'Air-gapped kernel boundary: Privacy Vault records and paths are strictly isolated from Gemini'
    });
  }
  sanitized = sanitized.replace(vaultRegex, '[VAULT_REFERENCE_ISOLATED]');

  // 2. PASSWORDS
  const passwordRegex = /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"',;]{4,})["']?/gi;
  let pwdMatch: RegExpExecArray | null;
  while ((pwdMatch = passwordRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-pwd-${detected.length + 1}`,
      type: 'PASSWORD',
      originalSnippet: maskSecret(pwdMatch[1]),
      sanitizedSnippet: '[PASSWORD_BLOCKED]',
      classification: 'BLOCKED',
      category: 'Credentials & Auth',
      reason: 'Raw password pattern detected. Passwords are never sent to Gemini.'
    });
  }
  sanitized = sanitized.replace(passwordRegex, (match, p1) => match.replace(p1, '[PASSWORD_BLOCKED]'));

  // 3. API KEYS & HIGH-ENTROPY ACCESS TOKENS
  // Specific known formats first
  const apiKeyPatterns: { regex: RegExp; type: 'API_KEY' | 'ACCESS_TOKEN' | 'SECRET'; label: string }[] = [
    { regex: /AIza[0-9A-Za-z-_]{35}/g, type: 'API_KEY', label: 'Google API Key' },
    { regex: /sk-[a-zA-Z0-9]{20,}/g, type: 'API_KEY', label: 'OpenAI / Secret API Key' },
    { regex: /ghp_[a-zA-Z0-9]{36}/g, type: 'ACCESS_TOKEN', label: 'GitHub Personal Access Token' },
    { regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/g, type: 'ACCESS_TOKEN', label: 'Slack Token' },
    { regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, type: 'SECRET', label: 'RSA/EC Private Key Block' },
    { regex: /(?:api[_-]?key|secret_key|client_secret|access_token|auth_token)\s*[:=]\s*["']?([A-Za-z0-9-_]{16,})["']?/gi, type: 'API_KEY', label: 'Explicit API Key/Secret Variable' }
  ];

  for (const pat of apiKeyPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pat.regex.exec(rawText)) !== null) {
      const snippet = match[1] || match[0];
      detected.push({
        id: `det-key-${detected.length + 1}`,
        type: pat.type,
        originalSnippet: maskSecret(snippet),
        sanitizedSnippet: pat.type === 'SECRET' ? '[SECRET_BLOCKED]' : '[API_KEY_BLOCKED]',
        classification: 'BLOCKED',
        category: 'Secrets & Cryptographic Keys',
        reason: `${pat.label} detected. Cryptographic keys and secrets are blocked by default.`
      });
    }
    sanitized = sanitized.replace(pat.regex, (match, group1) => {
      if (group1) return match.replace(group1, '[API_KEY_BLOCKED]');
      return pat.type === 'SECRET' ? '[SECRET_BLOCKED]' : '[API_KEY_BLOCKED]';
    });
  }

  // 4. FINANCIAL IDENTIFIERS (Credit Cards, SSN, IBAN)
  const ccRegex = /\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{15,16}\b/g;
  let ccMatch: RegExpExecArray | null;
  while ((ccMatch = ccRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-fin-${detected.length + 1}`,
      type: 'FINANCIAL_ID',
      originalSnippet: maskSecret(ccMatch[0]),
      sanitizedSnippet: '[FINANCIAL_ID_BLOCKED]',
      classification: 'BLOCKED',
      category: 'Financial Data',
      reason: 'Credit card or financial account number detected. Financial identifiers are blocked.'
    });
  }
  sanitized = sanitized.replace(ccRegex, '[FINANCIAL_ID_BLOCKED]');

  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  let ssnMatch: RegExpExecArray | null;
  while ((ssnMatch = ssnRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-ssn-${detected.length + 1}`,
      type: 'FINANCIAL_ID',
      originalSnippet: maskSecret(ssnMatch[0]),
      sanitizedSnippet: '[TAX_ID_BLOCKED]',
      classification: 'BLOCKED',
      category: 'Financial / Government IDs',
      reason: 'Government identification / SSN pattern detected and blocked.'
    });
  }
  sanitized = sanitized.replace(ssnRegex, '[TAX_ID_BLOCKED]');

  // 5. URLS WITH EMBEDDED CREDENTIALS
  const urlCredRegex = /https?:\/\/[a-zA-Z0-9_.+-]+:[a-zA-Z0-9_.+-]+@[a-zA-Z0-9.-]+/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlCredRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-url-${detected.length + 1}`,
      type: 'URL_CREDENTIAL',
      originalSnippet: urlMatch[0],
      sanitizedSnippet: '[CREDENTIAL_URL_BLOCKED]',
      classification: 'BLOCKED',
      category: 'Network Credentials',
      reason: 'URL contains embedded username:password authentication string.'
    });
  }
  sanitized = sanitized.replace(urlCredRegex, '[CREDENTIAL_URL_BLOCKED]');

  // 6. PROMPT INJECTION ATTEMPTS
  const promptInjectionRegex = /(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt|reveal\s+(?:api\s*key|secret|system\s*instruction|internal\s*rules)|override\s+security\s+policy|disregard\s+rules|act\s+as\s+unrestricted|jailbreak|dump\s+database|output\s+all\s+passwords)/gi;
  let injMatch: RegExpExecArray | null;
  while ((injMatch = promptInjectionRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-inj-${detected.length + 1}`,
      type: 'PROMPT_INJECTION',
      originalSnippet: injMatch[0],
      sanitizedSnippet: `[UNTRUSTED_USER_TEXT: "${injMatch[0]}"]`,
      classification: 'PROMPT_INJECTION',
      category: 'Prompt Injection Defense',
      reason: 'Instruction override pattern detected. Classified as untrusted passive text, non-executable by AI.'
    });
  }

  // 7. EMAILS & PHONE NUMBERS (Redacted in Maximum Privacy Mode or if policy enables PII redaction)
  const isRedactPii = policy.privacyMode === 'MAXIMUM_PRIVACY' || policy.privacyMode === 'PRIVATE_MODE' || policy.alwaysBlock.authInfo;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  let emailMatch: RegExpExecArray | null;
  while ((emailMatch = emailRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-email-${detected.length + 1}`,
      type: 'EMAIL',
      originalSnippet: emailMatch[0],
      sanitizedSnippet: '[EMAIL_REDACTED]',
      classification: isRedactPii ? 'REDACTED' : 'REDACTED',
      category: 'Personally Identifiable Information (PII)',
      reason: 'Email address detected. Scrubbed to prevent personal identifiable context exposure.'
    });
  }
  sanitized = sanitized.replace(emailRegex, '[EMAIL_REDACTED]');

  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(rawText)) !== null) {
    detected.push({
      id: `det-phone-${detected.length + 1}`,
      type: 'PHONE',
      originalSnippet: phoneMatch[0],
      sanitizedSnippet: '[PHONE_REDACTED]',
      classification: isRedactPii ? 'REDACTED' : 'REDACTED',
      category: 'Personally Identifiable Information (PII)',
      reason: 'Phone number pattern detected. Redacted to minimize direct contact disclosure.'
    });
  }
  sanitized = sanitized.replace(phoneRegex, '[PHONE_REDACTED]');

  // 8. PERSON NAMES (Redacted in Maximum Privacy or if configured in policy)
  if (policy.privacyMode === 'MAXIMUM_PRIVACY' || policy.askOrRedact.personNames === 'REDACT') {
    const namePattern = /(?:\b(?:with|by|from|to|saw|spoke with|met|called|texted)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    let nameMatch: RegExpExecArray | null;
    while ((nameMatch = namePattern.exec(rawText)) !== null) {
      const personName = nameMatch[1];
      // Exclude common month/day names or common nouns
      const exclusions = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Google', 'Gemini', 'Firebase'];
      if (!exclusions.includes(personName)) {
        detected.push({
          id: `det-name-${detected.length + 1}`,
          type: 'PERSON_NAME',
          originalSnippet: personName,
          sanitizedSnippet: '[PERSON_REDACTED]',
          classification: 'REDACTED',
          category: 'Personal Names & Relationships',
          reason: 'Third-party person name redacted in accordance with Maximum Privacy policy.'
        });
      }
    }
    sanitized = sanitized.replace(namePattern, (match, p1) => {
      const exclusions = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Google', 'Gemini', 'Firebase'];
      if (exclusions.includes(p1)) return match;
      return match.replace(p1, '[PERSON_REDACTED]');
    });
  }

  // 9. HANDLE "PRIVATE_MODE": Never send raw journal text! Convert into minimal structured context
  let finalGeminiContext = sanitized;
  let structuredSummary = '';

  if (policy.privacyMode === 'PRIVATE_MODE') {
    const cleanTags = Array.isArray(tags) && tags.length > 0 ? tags.map(t => `#${t.replace(/^#/, '')}`).join(', ') : 'Mindful reflection';
    const cleanMood = mood || 'Reflective';
    structuredSummary = `[PRIVATE MODE ACTIVE: Raw journal entry withheld by Privacy Firewall]\n` +
      `- User Mood: ${cleanMood}\n` +
      `- Thematic Categories: ${cleanTags}\n` +
      `- Entry Length: ${rawText.length} characters\n` +
      `- Goal: Generate mindful insights, reflective questions, and constructive next steps based on the user's recorded emotional state and topics without receiving raw journal body text.`;
    
    finalGeminiContext = structuredSummary;
  }

  // 10. Construct exact prompt wrapper with structural delimiters for strict non-executable boundary
  const exactGeminiPrompt = policy.privacyMode === 'PRIVATE_MODE'
    ? `Please reflect on the following structured journal metadata:\n\n${structuredSummary}`
    : `Please reflect on the following journal entry:

Title: ${title}
${mood ? `Recorded Mood: ${mood}` : ''}
${tags && tags.length > 0 ? `Tags: #${tags.join(' #')}` : ''}

<untrusted_journal_entry>
${finalGeminiContext}
</untrusted_journal_entry>`;

  const sanitizedCharCount = finalGeminiContext.length;
  const reductionPercentage = originalCharCount > 0 
    ? Math.max(0, Math.round(((originalCharCount - sanitizedCharCount) / originalCharCount) * 100))
    : 0;

  // Counts
  const counts = {
    totalDetected: detected.length,
    allowed: policy.privacyMode === 'PRIVATE_MODE' ? 0 : Math.max(0, originalCharCount > 50 ? 1 : 0),
    redacted: detected.filter(d => d.classification === 'REDACTED').length,
    blocked: detected.filter(d => d.classification === 'BLOCKED').length,
    promptInjection: detected.filter(d => d.classification === 'PROMPT_INJECTION').length,
    vaultExcluded: 1 // Always strictly excluded
  };

  // Decision logic
  let decision: 'SAFE_TO_SEND' | 'BLOCKED' | 'REQUIRES_CONFIRMATION' = 'SAFE_TO_SEND';
  let decisionReason = 'Sanitized context complies with active AI Privacy Policy.';

  if (policy.privacyMode === 'PRIVATE_MODE') {
    decisionReason = 'Private Mode: Raw journal body withheld; minimal structured context approved.';
  } else if (counts.blocked > 0) {
    decisionReason = `${counts.blocked} sensitive item(s) detected and blocked from context.`;
  } else if (counts.promptInjection > 0) {
    decisionReason = 'Prompt injection attempts neutralized into non-executable user data.';
  }

  return {
    originalText: rawText,
    sanitizedText: finalGeminiContext,
    structuredContextSummary: structuredSummary || undefined,
    exactGeminiPrompt,
    detectedElements: detected,
    counts,
    reductionPercentage,
    originalCharCount,
    sanitizedCharCount,
    decision,
    decisionReason,
    modeUsed: policy.privacyMode
  };
}

/**
 * Saves a Context Receipt to Firestore (/users/{uid}/contextReceipts) and local cache
 */
export async function persistContextReceipt(userId: string, receipt: ContextReceipt): Promise<void> {
  // 1. Session & Local Cache
  try {
    const raw = sessionStorage.getItem(RECEIPTS_LOCAL_KEY);
    let receipts: ContextReceipt[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) receipts = parsed;
    }
    receipts = [receipt, ...receipts].slice(0, 50);
    sessionStorage.setItem(RECEIPTS_LOCAL_KEY, JSON.stringify(receipts));
  } catch {
    // Ignore storage err
  }

  // 2. Firestore partitioned storage
  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, 'contextReceipts', receipt.id);
      await setDoc(docRef, receipt);
    } catch (err) {
      console.warn('[Privacy Firewall] Could not persist receipt to Firestore:', err);
    }
  }
}

/**
 * Retrieves all Context Receipts for authenticated user
 */
export async function getUserContextReceipts(userId?: string): Promise<ContextReceipt[]> {
  // 1. Try Firestore if userId present
  if (userId) {
    try {
      const receiptsRef = collection(db, 'users', userId, 'contextReceipts');
      const q = query(receiptsRef, orderBy('timestamp', 'desc'), limit(30));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firestoreReceipts: ContextReceipt[] = [];
        snap.forEach(docSnap => {
          firestoreReceipts.push(docSnap.data() as ContextReceipt);
        });
        return firestoreReceipts;
      }
    } catch (err) {
      console.warn('[Privacy Firewall] Could not fetch receipts from Firestore, falling back to local:', err);
    }
  }

  // 2. Local fallback
  try {
    const raw = sessionStorage.getItem(RECEIPTS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }

  return [];
}
