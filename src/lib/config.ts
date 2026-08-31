import firebaseConfigJson from '../../firebase-applet-config.json';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};

export const firebaseConfig: FirebaseAppletConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson?.projectId || 'gen-lang-client-0880003278',
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson?.appId || '1:530510614612:web:4966fc6d5e1999d8b05dc1',
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson?.apiKey || 'AIzaSyAVkjGD2hx7iDbMUzdkGyP3TYYWV1jEYBk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson?.authDomain || 'gen-lang-client-0880003278.firebaseapp.com',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson?.firestoreDatabaseId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson?.storageBucket || 'gen-lang-client-0880003278.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson?.messagingSenderId || '530510614612',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson?.measurementId,
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || firebaseConfigJson?.oAuthClientId,
  recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || firebaseConfigJson?.recaptchaSiteKey,
};
