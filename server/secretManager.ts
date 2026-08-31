import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';
import path from 'path';

export interface SecretResolutionStatus {
  provider: 'Google Cloud Secret Manager';
  secretName: string;
  version: string;
  status: 'SECRET_MANAGER_ACTIVE' | 'DEVELOPMENT_FALLBACK' | 'UNCONFIGURED';
  resourcePath: string;
  projectId: string;
  iamRole: 'roles/secretmanager.secretAccessor';
  rotationSupported: boolean;
  clientExposed: false;
  lastResolvedAt?: string;
  details: string;
}

// In-memory cache with Time-To-Live (5 minutes) to support live key rotation in Secret Manager without restart
interface CachedSecret {
  key: string;
  source: 'SECRET_MANAGER' | 'DEVELOPMENT_FALLBACK';
  expiresAt: number;
  resolvedAt: string;
}

let cachedSecret: CachedSecret | null = null;
let secretClient: any | null = null;
let lastKnownStatus: SecretResolutionStatus | null = null;

// Determine active Google Cloud Project ID
function getProjectId(): string {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  if (process.env.PROJECT_ID) return process.env.PROJECT_ID;

  // Attempt to read from firebase-applet-config.json if available
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.projectId) return parsed.projectId;
    }
  } catch {
    // Ignore read error
  }

  return 'gen-lang-client-0880003278';
}

async function getSecretClient(): Promise<any> {
  if (!secretClient) {
    try {
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      secretClient = new SecretManagerServiceClient();
    } catch (err: any) {
      console.warn('[AI] SecretManagerServiceClient could not be initialized, will use env fallback:', err?.message || err);
      return null;
    }
  }
  return secretClient;
}

/**
 * Retrieves the Gemini API Key from Google Cloud Secret Manager.
 * 
 * Flow:
 * 1. Resolves projects/{projectId}/secrets/GEMINI_API_KEY/versions/latest via SecretManagerServiceClient.
 * 2. Caches in server memory for 5 minutes (enables non-disruptive key rotation in Secret Manager).
 * 3. Gracefully falls back to process.env.GEMINI_API_KEY in local container/development mode without secret manager credentials.
 * 4. NEVER logs the secret or exposes it in error messages or client responses.
 */
export async function getGeminiApiKey(): Promise<{ apiKey: string; source: 'SECRET_MANAGER' | 'DEVELOPMENT_FALLBACK' }> {
  const now = Date.now();

  // Return non-expired cached secret if available
  if (cachedSecret && cachedSecret.expiresAt > now && cachedSecret.key) {
    return { apiKey: cachedSecret.key, source: cachedSecret.source };
  }

  const projectId = getProjectId();
  const secretName = process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY';
  const secretVersion = process.env.GEMINI_SECRET_VERSION || 'latest';
  const resourcePath = `projects/${projectId}/secrets/${secretName}/versions/${secretVersion}`;

  // 1. Attempt retrieval from Google Cloud Secret Manager
  try {
    const client = await getSecretClient();
    if (client) {
      console.log(`[AI] Attempting runtime secret retrieval from Google Cloud Secret Manager: projects/${projectId}/secrets/${secretName}/versions/${secretVersion}`);
      
      const [version] = await client.accessSecretVersion({
        name: resourcePath,
      });

      const payload = version.payload?.data;
      if (payload) {
        const secretValue = typeof payload === 'string' 
          ? payload 
          : Buffer.from(payload).toString('utf8');

        if (secretValue && secretValue.trim()) {
          const cleanKey = secretValue.trim();
          const resolvedAt = new Date().toISOString();
          
          // Cache for 5 minutes
          cachedSecret = {
            key: cleanKey,
            source: 'SECRET_MANAGER',
            expiresAt: now + 5 * 60 * 1000,
            resolvedAt
          };

          lastKnownStatus = {
            provider: 'Google Cloud Secret Manager',
            secretName,
            version: secretVersion,
            status: 'SECRET_MANAGER_ACTIVE',
            resourcePath,
            projectId,
            iamRole: 'roles/secretmanager.secretAccessor',
            rotationSupported: true,
            clientExposed: false,
            lastResolvedAt: resolvedAt,
            details: `Active secret version dynamically retrieved from Google Cloud Secret Manager (${resourcePath}).`
          };

          console.log('[AI] Secret retrieval succeeded from Google Cloud Secret Manager (latest version).');
          return { apiKey: cleanKey, source: 'SECRET_MANAGER' };
        }
      }
    }
  } catch (smError: any) {
    const errMsg = String(smError?.message || smError || '');
    // Log safe diagnostic category without leaking credentials, IAM payloads, or tokens
    console.warn(`[AI] Google Cloud Secret Manager unavailable in runtime (${errMsg.slice(0, 80)}). Evaluating server environment fallback.`);
  }

  // 2. Fallback to server-side process.env.GEMINI_API_KEY (for local development containers)
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim()) {
    const cleanKey = envKey.trim();
    const resolvedAt = new Date().toISOString();

    cachedSecret = {
      key: cleanKey,
      source: 'DEVELOPMENT_FALLBACK',
      expiresAt: now + 60 * 1000, // 1 minute cache for env fallback
      resolvedAt
    };

    lastKnownStatus = {
      provider: 'Google Cloud Secret Manager',
      secretName,
      version: secretVersion,
      status: 'DEVELOPMENT_FALLBACK',
      resourcePath,
      projectId,
      iamRole: 'roles/secretmanager.secretAccessor',
      rotationSupported: true,
      clientExposed: false,
      lastResolvedAt: resolvedAt,
      details: 'Google Cloud Secret Manager architecture configured. Server currently using development container environment variable fallback.'
    };

    console.log('[AI] Server using development environment variable fallback for Gemini API key.');
    return { apiKey: cleanKey, source: 'DEVELOPMENT_FALLBACK' };
  }

  // 3. No key configured anywhere
  lastKnownStatus = {
    provider: 'Google Cloud Secret Manager',
    secretName,
    version: secretVersion,
    status: 'UNCONFIGURED',
    resourcePath,
    projectId,
    iamRole: 'roles/secretmanager.secretAccessor',
    rotationSupported: true,
    clientExposed: false,
    details: 'Neither Google Cloud Secret Manager nor server environment configuration could provide the Gemini API key.'
  };

  throw new Error('AI service configuration unavailable.');
}

/**
 * Returns sanitized Secret Manager status for the Security Command Center.
 * Under NO circumstances is the secret value or private token included.
 */
export function getSecretManagerDiagnosticStatus(): SecretResolutionStatus {
  if (lastKnownStatus) {
    return lastKnownStatus;
  }

  const projectId = getProjectId();
  const secretName = process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY';
  const secretVersion = process.env.GEMINI_SECRET_VERSION || 'latest';
  const resourcePath = `projects/${projectId}/secrets/${secretName}/versions/${secretVersion}`;

  const hasEnv = Boolean(process.env.GEMINI_API_KEY);

  return {
    provider: 'Google Cloud Secret Manager',
    secretName,
    version: secretVersion,
    status: hasEnv ? 'DEVELOPMENT_FALLBACK' : 'UNCONFIGURED',
    resourcePath,
    projectId,
    iamRole: 'roles/secretmanager.secretAccessor',
    rotationSupported: true,
    clientExposed: false,
    details: hasEnv
      ? 'Google Cloud Secret Manager architecture active on server. Ready for production Secret Manager provisioning with roles/secretmanager.secretAccessor.'
      : 'Secret Manager unconfigured.'
  };
}
