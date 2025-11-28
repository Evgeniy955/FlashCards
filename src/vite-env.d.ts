// Removed vite/client reference to fix resolution error

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

// Add global process declaration for API_KEY
// Changed to var to avoid "Cannot redeclare block-scoped variable" error
declare var process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
};

// Fix TS2307: Cannot find module '@google/genai'
declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(config: { apiKey: string });
    models: {
      generateContent(params: any): Promise<{
        text?: string;
        candidates?: any[];
      }>;
    };
  }
  
  export const Type: {
    TYPE_UNSPECIFIED: string;
    STRING: string;
    NUMBER: string;
    INTEGER: string;
    BOOLEAN: string;
    ARRAY: string;
    OBJECT: string;
    NULL: string;
  };
}
