import { GoogleGenAI, Type } from "@google/genai";

// Safely access API Key from various possible sources
const getApiKey = (): string => {
    let key = '';

    // 1. Try process.env.API_KEY (injected by Vite config override)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env.API_KEY) {
            // @ts-ignore
            key = process.env.API_KEY;
        }
    } catch (e) {
        // ignore
    }

    // 2. Try standard Vite env vars (if user used VITE_ prefix in .env)
    // We check these as fallback, but Vite config usually injects them into process.env.API_KEY
    if (!key && import.meta.env.VITE_GEMINI_API_KEY) {
        key = import.meta.env.VITE_GEMINI_API_KEY;
    }
    if (!key && import.meta.env.VITE_API_KEY) {
        key = import.meta.env.VITE_API_KEY;
    }

    // Clean the key: remove quotes if the user accidentally included them in .env
    return key ? key.replace(/['"]/g, '').trim() : '';
};

const apiKey = getApiKey();

// --- DEBUGGING ---
if (apiKey) {
    const masked = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '***';
    console.log(`[Gemini] Using API Key: ${masked}`);
} else {
    console.warn('[Gemini] No API Key found.');
}
// -----------------

// Initialize the client lazily or safely
let ai: GoogleGenAI | null = null;

if (apiKey) {
    try {
        ai = new GoogleGenAI({ apiKey });
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI client:", error);
    }
}

// Helper to extract project ID from error message
const getProjectError = (errorString: string): string | null => {
    const projectMatch = errorString.match(/project\s+(\d+)/i);
    if (projectMatch && projectMatch[1]) {
        return `The active API Key belongs to Google Cloud Project ID: ${projectMatch[1]}. This project does not have the Gemini API enabled. Please update your .env file with a key from a different project.`;
    }
    return null;
};

export const generateExampleSentence = async (word: string): Promise<string> => {
    if (!ai) {
        throw new Error("API Key is missing. Check your .env file or Vercel settings.");
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, simple, and memorable example sentence in English containing the word "${word}". Return ONLY the sentence text. Do not include the translation or any explanations.`,
        });
        return response.text ? response.text.trim() : '';
    } catch (error: any) {
        console.error("Gemini generation error:", error);
        const errString = error.toString();

        // Check for specific Project ID error
        const projectError = getProjectError(errString);
        if (projectError) {
            throw new Error(projectError);
        }

        if (error.status === 403 || errString.includes('403')) {
            throw new Error("Access Denied (403). Check API Key restrictions in Google Cloud Console.");
        }

        throw error;
    }
};

export const validateAnswerWithAI = async (
    userAnswer: string,
    correctAnswer: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
    if (!ai) {
        return { isCorrect: false, feedback: "AI unavailable" };
    }

    const schema = {
        type: Type.OBJECT,
        properties: {
            isCorrect: {
                type: Type.BOOLEAN,
                description: "True if the user answer is a valid translation, synonym, or has only minor typos. False otherwise."
            },
            feedback: {
                type: Type.STRING,
                description: "A short, encouraging feedback message (max 10 words). If correct but different, explain why (e.g., 'Correct! That's a synonym'). If incorrect, briefly hint why."
            },
        },
        required: ["isCorrect", "feedback"],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
        Task: Validate a vocabulary flashcard answer.
        Target Word (Correct Answer): "${correctAnswer}"
        User's Answer: "${userAnswer}"
        
        Rules:
        1. Accept exact matches (case-insensitive).
        2. Accept valid synonyms (e.g., 'car' for 'automobile').
        3. Accept minor typos (1-2 letters wrong) if the meaning is clear.
        4. Reject completely wrong words.
        
        Respond in JSON.
      `,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const text = response.text;
        if (!text) return { isCorrect: false, feedback: "AI error" };

        return JSON.parse(text);
    } catch (error: any) {
        console.error("Gemini validation error:", error);
        const errString = error.toString();

        if (getProjectError(errString)) {
            return { isCorrect: false, feedback: "Wrong Project ID (Check Console)" };
        }

        if (error.status === 403 || errString.includes('403')) {
            return { isCorrect: false, feedback: "API Key 403 Forbidden" };
        }
        return { isCorrect: false, feedback: "" };
    }
};
