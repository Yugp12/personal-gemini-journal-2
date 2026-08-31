import type { ContextFirewallPolicy, PrivacyXRayReceipt, AIPrivacyPolicy, ContextReceipt } from '../types';
import { logSecurityEvent } from './securityService';
import { 
  DEFAULT_AI_PRIVACY_POLICY,
  getActivePrivacyPolicy,
  saveUserPrivacyPolicy,
  loadUserPrivacyPolicy,
  persistContextReceipt,
  getUserContextReceipts,
  inspectAndSanitizeJournal
} from './firewallEngine';

export {
  DEFAULT_AI_PRIVACY_POLICY,
  getActivePrivacyPolicy,
  saveUserPrivacyPolicy,
  loadUserPrivacyPolicy,
  persistContextReceipt,
  getUserContextReceipts,
  inspectAndSanitizeJournal
};

const FIREWALL_POLICY_STORAGE_KEY = 'pgj_gemini_context_firewall_policy';
const PRIVACY_RECEIPTS_STORAGE_KEY = 'pgj_privacy_xray_receipts';

export const DEFAULT_FIREWALL_POLICY: ContextFirewallPolicy = {
  allowJournalContent: true,
  allowJournalMetadata: true,
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
  strictPrivacyMode: false,
  aiPrivacyPolicy: DEFAULT_AI_PRIVACY_POLICY
};

/**
 * Retrieves the current active Context Firewall policy from browser storage or defaults
 */
export function getFirewallPolicy(): ContextFirewallPolicy {
  try {
    const raw = localStorage.getItem(FIREWALL_POLICY_STORAGE_KEY);
    const aiPolicy = getActivePrivacyPolicy();
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_FIREWALL_POLICY,
        ...parsed,
        allowedMemoryCategories: Array.isArray(parsed.allowedMemoryCategories)
          ? parsed.allowedMemoryCategories
          : DEFAULT_FIREWALL_POLICY.allowedMemoryCategories,
        aiPrivacyPolicy: aiPolicy
      };
    }
    return {
      ...DEFAULT_FIREWALL_POLICY,
      aiPrivacyPolicy: aiPolicy
    };
  } catch (err) {
    console.warn('[Firewall] Could not read stored firewall policy:', err);
  }
  return { ...DEFAULT_FIREWALL_POLICY, aiPrivacyPolicy: getActivePrivacyPolicy() };
}

/**
 * Saves and updates the active Context Firewall policy
 */
export function saveFirewallPolicy(policy: Partial<ContextFirewallPolicy>, userId?: string): ContextFirewallPolicy {
  const current = getFirewallPolicy();
  const updated: ContextFirewallPolicy = {
    ...current,
    ...policy,
    allowedMemoryCategories: Array.isArray(policy.allowedMemoryCategories)
      ? policy.allowedMemoryCategories
      : current.allowedMemoryCategories
  };

  try {
    localStorage.setItem(FIREWALL_POLICY_STORAGE_KEY, JSON.stringify(updated));
    if (policy.aiPrivacyPolicy && userId) {
      saveUserPrivacyPolicy(userId, policy.aiPrivacyPolicy);
    }
    logSecurityEvent(
      'FIREWALL_POLICY_UPDATED',
      `Context Firewall policy updated: Mode=${updated.aiPrivacyPolicy?.privacyMode || 'STANDARD'}, Memories=${updated.allowMemories ? 'ALLOWED' : 'BLOCKED'}, Metadata=${updated.allowJournalMetadata ? 'ALLOWED' : 'BLOCKED'}`,
      'info',
      'Context Firewall'
    );
  } catch (err) {
    console.error('[Firewall] Failed to persist firewall policy:', err);
  }

  return updated;
}

/**
 * Resets Context Firewall policy to default zero-trust configuration
 */
export function resetFirewallPolicy(userId?: string): ContextFirewallPolicy {
  try {
    localStorage.removeItem(FIREWALL_POLICY_STORAGE_KEY);
    if (userId) {
      saveUserPrivacyPolicy(userId, DEFAULT_AI_PRIVACY_POLICY);
    }
    logSecurityEvent('FIREWALL_POLICY_RESET', 'Context Firewall policy reset to standard baseline defaults', 'info', 'Context Firewall');
  } catch {
    // Ignore storage issues
  }
  return { ...DEFAULT_FIREWALL_POLICY, aiPrivacyPolicy: DEFAULT_AI_PRIVACY_POLICY };
}

/**
 * Saves a Privacy X-Ray receipt for auditing and transparency review
 */
export function recordPrivacyReceipt(receipt: PrivacyXRayReceipt, userId?: string): void {
  try {
    const raw = sessionStorage.getItem(PRIVACY_RECEIPTS_STORAGE_KEY);
    let currentReceipts: PrivacyXRayReceipt[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) currentReceipts = parsed;
    }

    const updated = [receipt, ...currentReceipts].slice(0, 30);
    sessionStorage.setItem(PRIVACY_RECEIPTS_STORAGE_KEY, JSON.stringify(updated));

    if (userId) {
      persistContextReceipt(userId, receipt);
    }
  } catch (err) {
    console.warn('[Firewall] Failed to record privacy receipt:', err);
  }
}

/**
 * Retrieves recent Privacy X-Ray receipts from session storage
 */
export function getPrivacyReceipts(): PrivacyXRayReceipt[] {
  try {
    const raw = sessionStorage.getItem(PRIVACY_RECEIPTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

/**
 * Sanitizes sensitive identifiers if strict privacy mode is active
 */
export function applyStrictSanitization(text: string, strictMode: boolean): { sanitized: string; appliedRules: string[] } {
  if (!strictMode || !text) {
    return { sanitized: text || '', appliedRules: [] };
  }

  const result = inspectAndSanitizeJournal(text);
  return {
    sanitized: result.sanitizedText,
    appliedRules: result.detectedElements.map(d => d.type)
  };
}
