import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  privacyPreferences: {
    autoPurgePrivate: boolean;
  };
}

export type PrivacyMode = 'STANDARD' | 'MAXIMUM_PRIVACY' | 'PRIVATE_MODE';

export type SensitiveClassification = 'ALLOWED' | 'REDACTED' | 'BLOCKED' | 'ASK_USER' | 'PROMPT_INJECTION' | 'VAULT_EXCLUDED';

export type SensitiveElementType = 
  | 'EMAIL'
  | 'PHONE'
  | 'API_KEY'
  | 'ACCESS_TOKEN'
  | 'PASSWORD'
  | 'SECRET'
  | 'FINANCIAL_ID'
  | 'URL_CREDENTIAL'
  | 'PERSON_NAME'
  | 'PROMPT_INJECTION'
  | 'VAULT_REFERENCE'
  | 'LOCATION'
  | 'UNNECESSARY_PII';

export interface SensitiveElement {
  id: string;
  type: SensitiveElementType;
  originalSnippet: string; // Masked if secret/password
  sanitizedSnippet: string;
  classification: SensitiveClassification;
  category: string;
  reason: string;
  startIndex?: number;
  endIndex?: number;
}

export interface SanitizationResult {
  originalText: string;
  sanitizedText: string;
  structuredContextSummary?: string; // Used when in PRIVATE_MODE
  exactGeminiPrompt: string;
  detectedElements: SensitiveElement[];
  counts: {
    totalDetected: number;
    allowed: number;
    redacted: number;
    blocked: number;
    promptInjection: number;
    vaultExcluded: number;
  };
  reductionPercentage: number;
  originalCharCount: number;
  sanitizedCharCount: number;
  decision: 'SAFE_TO_SEND' | 'BLOCKED' | 'REQUIRES_CONFIRMATION';
  decisionReason: string;
  modeUsed: PrivacyMode;
}

export interface AIPrivacyPolicy {
  privacyMode: PrivacyMode;
  alwaysBlock: {
    passwords: boolean;
    apiKeys: boolean;
    accessTokens: boolean;
    financialIdentifiers: boolean;
    vaultContent: boolean;
    authInfo: boolean;
  };
  allow: {
    projects: boolean;
    goals: boolean;
    productivity: boolean;
    generalEmotions: boolean;
    habits: boolean;
    generalReflections: boolean;
  };
  askOrRedact: {
    personNames: 'REDACT' | 'ASK' | 'ALLOW';
    locations: 'REDACT' | 'ASK' | 'ALLOW';
    relationships: 'REDACT' | 'ASK' | 'ALLOW';
    personalExperiences: 'REDACT' | 'ASK' | 'ALLOW';
  };
  allowMemories: boolean;
  allowedMemoryCategories: string[];
  allowConversationHistory: boolean;
  maxHistoryTurns: number;
  updatedAt?: string;
}

export interface ContextFirewallPolicy {
  privacyMode?: PrivacyMode;
  allowJournalContent: boolean;
  allowJournalMetadata: boolean; // mood, tags, timestamps
  allowMemories: boolean;
  allowedMemoryCategories: string[]; // e.g. ['Preference', 'Goal', 'Project', 'Personal Context', 'Habit', 'Other']
  allowConversationHistory: boolean;
  maxHistoryTurns: number;
  strictPrivacyMode: boolean; // extra sanitization of emails/phone numbers/tokens
  aiPrivacyPolicy?: AIPrivacyPolicy;
}

export interface ContextReceipt {
  id: string;
  userId?: string;
  timestamp: string;
  operation: 'JOURNAL_REFLECTION' | 'CONVERSATION_TURN';
  originalCharCount: number;
  geminiCharCount: number;
  reductionPercentage: number;
  detectedElementsCount: number;
  redactedCount: number;
  blockedCount: number;
  vaultCount: number; // Always 0
  promptInjectionAttempts: number;
  policyMode: PrivacyMode;
  decision: 'SAFE_TO_SEND' | 'BLOCKED' | 'USER_CONFIRMED';
  decisionReason: string;
  modelUsed: string;
  sanitizationRulesApplied: string[];
  detectedSummary: {
    type: string;
    classification: string;
    description: string;
  }[];
  exactGeminiContextPreview?: string;
}

export interface PrivacyXRayReceipt extends ContextReceipt {
  permittedSources: string[];
  blockedSources: string[];
  inspectedSources: {
    category: string;
    itemsEvaluated: number;
    itemsAllowed: number;
    itemsBlocked: number;
    status: 'PERMITTED' | 'BLOCKED' | 'HARD_EXCLUDED_BY_KERNEL';
    reason: string;
  }[];
  vaultStatus: 'HARD_BLOCKED_AND_ISOLATED';
  totalContextChars: number;
  totalContextTokensEstimate: number;
  sanitizationApplied: string[];
  policyEnforced: string;
}

export interface AIReflection {
  summary: string;
  insights: string[];
  questions: string[];
  suggestedTags: string[];
  generatedAt: Timestamp | { seconds: number; nanoseconds?: number } | Date | string;
  privacyReceipt?: PrivacyXRayReceipt;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: string;
  tags: string[];
  reflection?: string;
  aiReflection?: AIReflection;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateJournalInput {
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
}

export interface UpdateJournalInput {
  title?: string;
  content?: string;
  mood?: string;
  tags?: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  createdAt: Timestamp;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MemoryCategory = 
  | 'Preference'
  | 'Goal'
  | 'Project'
  | 'Personal Context'
  | 'Habit'
  | 'Other';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory | string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type UserMemory = Memory;

export type VaultCategory =
  | 'Personal'
  | 'Important'
  | 'Private Note'
  | 'Other';

export interface VaultRecord {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: VaultCategory | string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type VaultItem = VaultRecord;

export interface AuthContextType {
  user: import('firebase/auth').User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  reauthenticateWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}
