// Removed vite/client reference to fix resolution error

export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID: string;
    readonly VITE_GEMINI_API_KEY?: string;
    readonly VITE_API_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Augment NodeJS namespace if it exists (from @types/node)
  // This allows process.env.API_KEY to be typed if process is used
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
      [key: string]: string | undefined;
    }
  }
}
