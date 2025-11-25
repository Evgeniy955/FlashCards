import { GoogleGenAI, Type } from "@google/genai";

// Safely access process.env.API_KEY.
const getApiKey = (): string => {
    try {
        // @ts-ignore
        return process.env.API_KEY || '';
    } catch (e) {
        return '';
    }
};

const apiKey = getApiKey();

// Initialize the client only if we have a key, otherwise we handle it in the functions
const ai = new GoogleGenAI({ apiKey });

export const generateExampleSentence = async (word: string): Promise<string> => {
    if (!apiKey) {
        console.warn("Gemini API key is missing.");
        return '';
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, simple, and memorable example sentence in English containing the word "${word}". Return ONLY the sentence text. Do not include the translation or any explanations.`,
        });
        return response.text ? response.text.trim() : '';
    } catch (error) {
        console.error("Gemini generation error:", error);
        return '';
    }
};

export const validateAnswerWithAI = async (
    userAnswer: string,
    correctAnswer: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
    if (!apiKey) {
        // Fallback: If AI is missing, we can't do fuzzy matching, so we assume incorrect if simple check passed earlier.
        // But logic in App.tsx calls this only if simple check FAILED.
        // So we return false here.
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
    } catch (error) {
        console.error("Gemini validation error:", error);
        return { isCorrect: false, feedback: "" };
    }
};
