import { GoogleGenAI, Type } from "@google/genai";

// Safely access API Key from various possible sources
const getApiKey = (): string => {
    let key = '';

    // 1. Try process.env.API_KEY (injected by Vite config override)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env?.API_KEY) {
            // @ts-ignore
            key = process.env.API_KEY;
        }
    } catch (e) {
        // ignore
    }

    // 2. Try standard Vite env vars (if user used VITE_ prefix in .env)
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

// Initialize the client lazily or safely
let ai: GoogleGenAI | null = null;

if (apiKey) {
    try {
        ai = new GoogleGenAI({ apiKey });
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI client:", error);
    }
} else {
    console.debug("Gemini API Key is missing. AI features will be disabled.");
}

export const generateExampleSentence = async (word: string): Promise<string> => {
    if (!ai) {
        console.error("GoogleGenAI client is not initialized (Missing API Key).");
        throw new Error("API Key is missing. Please check your settings.");
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, simple, and memorable example sentence in English containing the word "${word}". Return ONLY the sentence text. Do not include the translation or any explanations.`,
        });
        return response.text ? response.text.trim() : '';
    } catch (error: any) {
        console.error("Gemini generation error:", error);

        // Handle 403 specifically
        if (error.status === 403 || error.toString().includes('403')) {
            throw new Error("Access Denied (403). Your API Key is restricted or invalid. If you are on localhost, check your API Key Referrer restrictions.");
        }

        throw error;
    }
};

export const validateAnswerWithAI = async (
    userAnswer: string,
    correctAnswer: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
    if (!ai) {
        return { isCorrect: false, feedback: "AI unavailable (Check Key)" };
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
        if (error.status === 403 || error.toString().includes('403')) {
            return { isCorrect: false, feedback: "API Key 403 Forbidden" };
        }
        return { isCorrect: false, feedback: "" };
    }
};
