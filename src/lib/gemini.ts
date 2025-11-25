import { GoogleGenAI, Type } from "@google/genai";

// Safely access process.env.API_KEY to avoid runtime crashes
const getApiKey = (): string => {
    try {
        // The build tool replaces process.env.API_KEY with the string value.
        // We check existence to be safe.
        if (typeof process !== 'undefined' && process.env) {
            return process.env.API_KEY || '';
        }
    } catch (e) {
        // Ignore ReferenceError if process is not defined, but log it for debug/linter satisfaction
        console.debug("Process env not available", e);
    }
    return '';
};

const apiKey = getApiKey();

// Initialize the client.
const ai = new GoogleGenAI({ apiKey });

export const generateExampleSentence = async (word: string): Promise<string> => {
    if (!apiKey) {
        console.warn("Gemini API key is missing. Skipping sentence generation.");
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
        return ''; // Return empty string gracefully on error
    }
};

export const validateAnswerWithAI = async (
    userAnswer: string,
    correctAnswer: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
    if (!apiKey) {
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
        // Fallback to basic correct/incorrect if AI fails, but don't crash
        return { isCorrect: false, feedback: "" };
    }
};
