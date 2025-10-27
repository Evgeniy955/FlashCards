import React from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase-client';

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
        <path fill="none" d="M0 0h48v48H0z"></path>
    </svg>
);

interface AuthProps {
    user: User | null;
}

export const Auth: React.FC<AuthProps> = ({ user }) => {
    
    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Authentication failed:", error);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    };

    if (user) {
        return (
            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg">
                <img src={user.photoURL || undefined} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border-2 border-slate-500" />
                <div className="text-sm">
                    <p className="font-semibold text-white truncate max-w-[100px]">{user.displayName}</p>
                    <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-rose-400 transition-colors">Sign Out</button>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleSignIn}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-md"
        >
            <GoogleIcon /> Sign in
        </button>
    );
};