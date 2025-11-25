/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Fix TS2591: Explicitly declare global process variable.
// This is required because we are using process.env.API_KEY in a browser environment (shimmed by Vite),
// but without @types/node installed, TypeScript doesn't know 'process' exists.
declare const process: {
    env: {
        API_KEY?: string;
        [key: string]: any;
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
