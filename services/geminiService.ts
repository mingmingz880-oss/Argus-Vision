import { GoogleGenAI, Type } from "@google/genai";

// Ideally, this is injected or retrieved securely. 
// Per instructions, we assume process.env.API_KEY is available.
const API_KEY = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface ParsedRule {
  object_name: string;
  action_description: string;
  suggested_duration: number;
  suggested_level: 'HIGH' | 'MEDIUM' | 'LOW';
  valid: boolean;
  reason?: string;
}

export const parseRuleDescription = async (userInput: string): Promise<ParsedRule> => {
  if (!API_KEY) {
    console.warn("API Key missing, returning mock response for demo.");
    return new Promise((resolve) => setTimeout(() => resolve({
        object_name: "Mock Object",
        action_description: userInput,
        suggested_duration: 3,
        suggested_level: 'HIGH',
        valid: true
    }), 1000));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Parse the following video analytics request into a structured configuration: "${userInput}". 
      If the request is vague or impossible to visualize, set valid to false.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            object_name: { type: Type.STRING, description: "The main object to detect, e.g., 'Person', 'Car'" },
            action_description: { type: Type.STRING, description: "The action or state, e.g., 'Smoking', 'Running'" },
            suggested_duration: { type: Type.NUMBER, description: "Suggested trigger duration in seconds. 0 if immediate." },
            suggested_level: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"], description: "Suggested alarm severity." },
            valid: { type: Type.BOOLEAN, description: "Is the request clear and viable?" },
            reason: { type: Type.STRING, description: "Reason if invalid." }
          },
          required: ["object_name", "action_description", "suggested_duration", "suggested_level", "valid"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as ParsedRule;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback for demo resilience
    return {
        object_name: "Unknown",
        action_description: userInput,
        suggested_duration: 0,
        suggested_level: 'MEDIUM',
        valid: false,
        reason: "API Error or Timeout"
    };
  }
};
