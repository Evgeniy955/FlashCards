import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase-client';
import { LogIn, LogOut } from 'lucide-react';

export const Auth: React.FC = () => {
  // Defensive check: If Firebase auth isn't initialized, don't render auth-dependent hooks.
  if (!auth || !googleProvider) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 opacity-50 cursor-not-allowed"
      >
        <LogIn size={16} /> Sign in with Google
      </button>
    );
  }

  const [user, loading, error] = useAuthState(auth);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error during sign-in:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (loading) {
    return <div className="w-28 h-10 bg-slate-700 rounded-lg animate-pulse"></div>;
  }

  if (error) {
    return <p className="text-red-400 text-sm">Auth Error</p>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={user.photoURL || undefined}
          alt={user.displayName || 'User'}
          className="w-8 h-8 rounded-full"
        />
        <button
          onClick={handleSignOut}
          className="px-3 py-2 bg-rose-800 hover:bg-rose-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
    >
      <LogIn size={16} /> Sign in with Google
    </button>
  );
};