import { GoogleGenAI, Type } from "@google/genai";

// Initialize the client using the environment variable injected by Vite.
// We cast to string to satisfy TypeScript, as the build process guarantees replacement.
const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) || '' });

// Helper to extract project ID from error message
const getProjectError = (errorString: string): string | null => {
    // Use RegExp.exec for better performance/safety as suggested by linters
    const projectMatch = /project\s+(\d+)/i.exec(errorString);
    if (projectMatch && projectMatch[1]) {
        return `The active API Key belongs to Google Cloud Project ID: ${projectMatch[1]}. This project does not have the Gemini API enabled. Please update your .env file with a key from a different project.`;
    }
    return null;
};

export const generateExampleSentence = async (word: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, simple, and memorable example sentence in English containing the word "${word}". Return ONLY the sentence text. Do not include the translation or any explanations.`,
        });
        return response.text?.trim() || '';
    } catch (error: any) {
        console.error("Gemini generation error:", error);
        const errString = error.toString();

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

// --- Conversation / Chat Feature ---

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const chatWithAI = async (
    history: ChatMessage[],
    scenario: string,
    mode: 'free' | 'roleplay',
    userName?: string
): Promise<string> => {

    const nameInstruction = userName ? `The student's name is ${userName}. Use their name naturally in the conversation, especially when greeting.` : '';

    const roleInstruction = mode === 'roleplay'
        ? `Scenario: ${scenario}. Stay strictly in character.`
        : `Topic: ${scenario}. Be a friendly conversational partner.`;

    const systemPrompt = `
    You are a helpful English language tutor helping a student practice speaking.
    ${nameInstruction}
    ${roleInstruction}
    
    IMPORTANT RULES:
    1. **Conciseness**: Keep your responses short (1-3 sentences max) to simulate natural spoken dialogue.
    2. **Corrections**: If the user makes a grammar or vocabulary mistake, reply naturally first, and then add a correction at the very end in parentheses. Example: "I agree with you. (Correction: You said 'I goed', but it should be 'I went')".
    3. **Engagement**: Always end with a relevant question to keep the conversation going.
    `;

    try {
        const contents = [
            {
                role: 'user',
                parts: [{ text: systemPrompt }]
            },
            ...history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))
        ];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        return response.text?.trim() || "I'm listening...";
    } catch (error: any) {
        console.error("Gemini chat error:", error);
        const errString = error.toString();

        const projectError = getProjectError(errString);
        if (projectError) throw new Error(projectError);
        if (error.status === 403 || errString.includes('403')) throw new Error("Access Denied (403). Check API Key.");

        throw new Error("Failed to connect to AI.");
    }
};
