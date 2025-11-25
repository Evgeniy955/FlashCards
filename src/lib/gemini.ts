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

// Initialize the client lazily or safely
let ai: GoogleGenAI | null = null;
try {
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.warn("Gemini API Key is missing. AI features will be disabled.");
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI client:", error);
}

export const generateExampleSentence = async (word: string): Promise<string> => {
  if (!ai) {
    console.error("GoogleGenAI client is not initialized (Missing API Key).");
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
  if (!ai) {
    return { isCorrect: false, feedback: "AI unavailable (Missing Key)" };
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