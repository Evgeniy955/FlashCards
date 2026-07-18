
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

const AVAILABLE_GEMINI_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.5-flash',
] as const;

export interface GeminiExecutionMetadata {
    usedModel: string;
    requestedModel: string;
    fellBack: boolean;
}

export interface GeminiTextResult extends GeminiExecutionMetadata {
    text: string;
}

export interface GeminiValidationResult extends GeminiExecutionMetadata {
    isCorrect: boolean;
    feedback: string;
}

const isRateLimitError = (error: any): boolean => {
    const errString = String(error);
    return (
        error?.status === 429 ||
        errString.includes('429') ||
        errString.includes('RESOURCE_EXHAUSTED') ||
        errString.toLowerCase().includes('rate limit') ||
        errString.toLowerCase().includes('quota')
    );
};

const getFallbackModelOrder = (requestedModel: string): string[] => {
    const normalizedRequestedModel = AVAILABLE_GEMINI_MODELS.includes(requestedModel as any)
        ? requestedModel
        : AVAILABLE_GEMINI_MODELS[0];
    const remainingModels = AVAILABLE_GEMINI_MODELS.filter(model => model !== normalizedRequestedModel);
    return [normalizedRequestedModel, ...remainingModels];
};

const withModelFallback = async <T>(
    requestedModel: string,
    runner: (modelName: string) => Promise<T>
): Promise<{ result: T; metadata: GeminiExecutionMetadata }> => {
    const orderedModels = getFallbackModelOrder(requestedModel);
    let lastError: any = null;

    for (const modelName of orderedModels) {
        try {
            const result = await runner(modelName);
            return {
                result,
                metadata: {
                    usedModel: modelName,
                    requestedModel,
                    fellBack: modelName !== requestedModel,
                },
            };
        } catch (error: any) {
            lastError = error;
            if (!isRateLimitError(error)) {
                throw error;
            }
        }
    }

    throw lastError;
};

export const generateExampleSentence = async (
    modelName: string,
    word: string,
    targetLang: string = 'English',
    nativeLang: string = 'English'
): Promise<GeminiTextResult> => {
    try {
        const { result, metadata } = await withModelFallback(modelName, async (activeModel) => {
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: `
            Analyze the input: "${word}" (Target Language: ${targetLang}). 
            Create "Flashcard Content" for a student whose native language is ${nativeLang}.
            
            ADAPTIVE INSTRUCTIONS:
            1. If the input is a SINGLE WORD or SHORT PHRASE:
               - 📖 **Meaning:** A simple definition in ${targetLang}.
               - 🔗 **Link:** A common 2-3 word collocation or phrase.
               - ✍️ **Example:** A single vivid and memorable sentence.

            2. If the input is a FULL SENTENCE or LONG EXPRESSION:
               - 📖 **Context:** Explain the nuance, tone, or specific situation where this sentence is used.
               - 🔗 **Variations Link:** Provide 1-2 alternative ways to say the same thing.
               - ✍️ **Dialogue Example:** Provide a short, natural dialogue (2-4 lines) where this sentence is used in a real conversation.
            
            CONSTRAINTS:
            - Output format MUST strictly follow the emojis and bold labels above.
            - Do not include translations unless essential for rare idioms.
            - Keep language complexity at A2-B1 level.
            - Use the labels "Meaning/Context", "Link", and "Example" (or "Dialogue Example") to ensure UI highlighting.
            `,
            });
            return response.text?.trim() || '';
        });

        return {
            text: result,
            ...metadata,
        };
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
    modelName: string, // Use the selected modelName
    userAnswer: string,
    correctAnswer: string,
    targetLanguage: string = 'English'
): Promise<GeminiValidationResult> => {

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
        const { result, metadata } = await withModelFallback(modelName, async (activeModel) => {
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: `
        Task: Validate a vocabulary flashcard answer.
        Target Language: ${targetLanguage}
        Target Word (Correct Answer): "${correctAnswer}"
        User's Answer: "${userAnswer}"
        
        Rules:
        1. Accept exact matches (case-insensitive).
        2. Accept valid synonyms in ${targetLanguage}.
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

            return JSON.parse(text) as { isCorrect: boolean; feedback: string };
        });

        return {
            ...result,
            ...metadata,
        };
    } catch (error: any) {
        console.error("Gemini validation error:", error);
        const errString = error.toString();

        if (getProjectError(errString)) {
            return {
                isCorrect: false,
                feedback: "Wrong Project ID (Check Console)",
                usedModel: modelName,
                requestedModel: modelName,
                fellBack: false,
            };
        }

        if (error.status === 403 || errString.includes('403')) {
            return {
                isCorrect: false,
                feedback: "API Key 403 Forbidden",
                usedModel: modelName,
                requestedModel: modelName,
                fellBack: false,
            };
        }
        return {
            isCorrect: false,
            feedback: "",
            usedModel: modelName,
            requestedModel: modelName,
            fellBack: false,
        };
    }
};

// --- Conversation / Chat Feature ---

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export type ChatMode = 'free' | 'roleplay' | 'topic-practice';

export const chatWithAI = async (
    modelName: string,
    history: ChatMessage[],
    scenario: string,
    mode: ChatMode,
    userName?: string
): Promise<GeminiTextResult> => {

    const nameInstruction = userName ? `The student's name is ${userName}. Use their name naturally in the conversation, especially when greeting.` : '';

    const roleInstruction = mode === 'roleplay'
        ? `Scenario: ${scenario}. Stay strictly in character.`
        : mode === 'topic-practice'
            ? `Practice Topic: ${scenario}. Help the student actively practice this exact topic and stay on it unless they clearly change topics.`
            : `Topic: ${scenario}. Be a friendly conversational partner.`;

    const correctionRules = mode === 'topic-practice'
        ? `
    2. **Tense Corrections Are Required**: If the student uses the wrong tense, you must correct it at the end of your reply in parentheses.
    3. **Other Mistakes**: For non-tense mistakes, prioritize understanding. Correct only when the mistake makes the sentence unnatural or hard to understand.
    4. **Topic Practice**: Keep the conversation focused on the chosen topic and help the student reuse related vocabulary and phrases.
    5. **Supportive Rephrasing**: If the student expresses an idea awkwardly, answer their meaning first and then offer a more natural version.
    6. **Engagement**: Always end with a short, relevant follow-up question to keep the practice going.
    `
        : `
    2. **Corrections**: If the user makes a grammar or vocabulary mistake, reply naturally first, and then add a correction at the very end in parentheses. Example: "I agree with you. (Correction: You said 'I goed', but it should be 'I went')".
    3. **Engagement**: Always end with a relevant question to keep the conversation going.
    `;

    const systemPrompt = `
    You are a helpful English language tutor helping a student practice speaking.
    ${nameInstruction}
    ${roleInstruction}
    
    IMPORTANT RULES:
    1. **Conciseness**: Keep your responses short (1-3 sentences max) to simulate natural spoken dialogue.
    ${correctionRules}
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

        const { result, metadata } = await withModelFallback(modelName, async (activeModel) => {
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: contents,
            });

            return response.text?.trim() || "I'm listening...";
        });

        return {
            text: result,
            ...metadata,
        };
    } catch (error: any) {
        console.error("Gemini chat error:", error);
        const errString = error.toString();
        
        const projectError = getProjectError(errString);
        if (projectError) throw new Error(projectError);
        if (error.status === 403 || errString.includes('403')) throw new Error("Access Denied (403). Check API Key.");
        
        throw new Error("Failed to connect to AI.");
    }
};
