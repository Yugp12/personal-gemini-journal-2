import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  type User, 
  onAuthStateChanged, 
  signInWithGoogle as firebaseSignInWithGoogle, 
  reauthenticateWithGoogle as firebaseReauthenticateWithGoogle,
  signOut as firebaseSignOut, 
  auth,
  db 
} from './firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { logSecurityEvent } from './securityService';
import type { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        setError(null);

        if (currentUser) {
          try {
            // Ensure per-user profile document is initialized with least-privilege metadata
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                privacyPreferences: {
                  autoPurgePrivate: true
                }
              }, { merge: true });
            } else {
              await setDoc(userRef, {
                lastLoginAt: serverTimestamp()
              }, { merge: true });
            }
          } catch (err: unknown) {
            console.error('Failed to sync user profile:', err);
            // Non-fatal error; UI can still continue with authenticated session
          }
        }

        setLoading(false);
      },
      (authError) => {
        console.error('Firebase Auth state error:', authError);
        setError(authError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setError(null);
      await firebaseSignInWithGoogle();
      logSecurityEvent('AUTH_SIGN_IN', 'User successfully authenticated with Google OAuth.', 'secure', 'Firebase Auth');
    } catch (err: any) {
      // Gracefully handle harmless user dismissals and popup interruptions
      if (
        err?.code === 'auth/user-cancelled' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User intentionally closed the popup or clicked cancel; clear error state gracefully
        setError(null);
        return;
      }

      if (err?.code === 'auth/popup-blocked') {
        setError('The sign-in popup was blocked by your browser. Please allow popups or open the app in a new tab.');
        return;
      }

      if (err?.code === 'auth/unauthorized-domain') {
        setError('Unauthorized Domain: Please add your deployment URL (e.g. personal-gemini-journal-2-1mts.vercel.app) to Firebase Console > Authentication > Settings > Authorized Domains.');
        return;
      }

      console.error('Google Sign-In failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(message);
    }
  };

  const handleReauthenticate = async (): Promise<void> => {
    try {
      setError(null);
      await firebaseReauthenticateWithGoogle();
      logSecurityEvent('REAUTHENTICATION_SUCCESS', 'Reauthentication verified for elevated privacy action.', 'secure', 'Firebase Auth');
    } catch (err: any) {
      if (
        err?.code === 'auth/user-cancelled' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error('Reauthentication was cancelled.');
      }
      if (err?.code === 'auth/popup-blocked') {
        throw new Error('The verification popup was blocked by your browser. Please allow popups to continue.');
      }
      if (err?.code === 'auth/unauthorized-domain') {
        throw new Error('Unauthorized Domain: Please add your deployment URL to Firebase Console > Authentication > Settings > Authorized Domains.');
      }
      console.error('Google Reauthentication failed:', err);
      const message = err instanceof Error ? err.message : 'Reauthentication failed';
      throw new Error(message);
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      await firebaseSignOut();
      logSecurityEvent('AUTH_SIGN_OUT', 'User signed out. Local session memory purged.', 'info', 'Firebase Auth');
    } catch (err: unknown) {
      console.error('Sign-Out failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      throw err;
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(false);
    } catch (err) {
      console.error('Failed to retrieve fresh ID token:', err);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle: handleSignIn,
        reauthenticateWithGoogle: handleReauthenticate,
        signOut: handleSignOut,
        getIdToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
