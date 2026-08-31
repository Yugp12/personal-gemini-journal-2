import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { JournalShell } from './components/JournalShell';
import { 
  ShieldCheck, 
  Lock, 
  LogIn, 
  Sparkles, 
  AlertCircle, 
  Loader2
} from 'lucide-react';

function LoggedOutView() {
  const { signInWithGoogle, error } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <div className="max-w-lg w-full space-y-6 text-center">
        {/* Logo and Intro */}
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-neutral-200/70 text-xs font-medium text-neutral-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Zero-Trust Private Journaling</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
            Personal Gemini Journal
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
            Your private, AI-augmented sanctuary for reflections, habits, multi-turn dialogues, and encrypted memories.
          </p>
        </div>

        {/* Security / Sign In Card */}
        <div id="auth-state-container" className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-8 space-y-6 text-left">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">Zero-Trust Identity Guard</h2>
                <p className="text-xs text-neutral-500">Google OAuth & Path-Bound Firestore Partitions</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
              <Lock className="w-3 h-3 text-neutral-500" />
              <span>Protected</span>
            </div>
          </div>

          {error && (
            <div id="auth-error-banner" className="p-4 rounded-xl bg-red-50/80 border border-red-200 text-red-700 flex items-start space-x-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Notice</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Every journal entry, AI reflection, and memory insight is strictly isolated to your authenticated UID. No unauthorized party or secondary user can query or mutate your records.
            </p>

            <button
              id="btn-google-signin"
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center space-x-2.5 py-3 px-6 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-2xl transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google'}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function MainContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-neutral-900">
        <div className="flex flex-col items-center space-y-3 bg-white p-8 rounded-3xl border border-neutral-200 shadow-xs">
          <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
          <p className="text-xs font-semibold text-neutral-600 font-mono">
            Verifying cryptographic identity...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <LoggedOutView />;
  }

  return <JournalShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
