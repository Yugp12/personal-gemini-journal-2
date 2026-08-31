import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  reauthenticateWithPopup,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore 
} from 'firebase/firestore';
import { firebaseConfig } from './config';

// Initialize Firebase App instance safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Configure Google Sign-In Provider with required prompts
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Helper for Google Sign-In
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Helper for Google Reauthentication (Second Verification Step)
export async function reauthenticateWithGoogle(): Promise<User> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user session found to reauthenticate.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await reauthenticateWithPopup(currentUser, provider);
  return result.user;
}

// Helper for Sign-Out
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// Initialize Firestore with specific databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export { onAuthStateChanged };
export type { User };
