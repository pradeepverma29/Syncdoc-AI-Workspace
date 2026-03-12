import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// The API key is injected by the platform at runtime
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * Stream content generation from Gemini
 * @param prompt - The user's prompt
 * @param context - Optional context (e.g., current document content)
 * @param onChunk - Callback for each chunk of text received
 */
export const streamGeminiContent = async (
  prompt: string,
  context: string = "",
  onChunk: (text: string) => void
) => {
  try {
    const model = "gemini-3-flash-preview";
    
    const fullPrompt = context 
      ? `Context from current document:\n${context}\n\nUser request: ${prompt}`
      : prompt;

    const responseStream = await ai.models.generateContentStream({
      model,
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        systemInstruction: "You are a helpful writing assistant for a collaborative document editor. Help the user write, summarize, or improve their text. Keep responses concise and relevant to the document context.",
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        onChunk(text);
      }
    }
  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    throw error;
  }
};

/**
 * Summarize the document content
 */
export const summarizeDocument = async (content: string, onChunk: (text: string) => void) => {
  return streamGeminiContent("Please provide a concise summary of this document.", content, onChunk);
};

/**
 * Fix grammar and spelling
 */
export const fixGrammar = async (content: string, onChunk: (text: string) => void) => {
  return streamGeminiContent("Please fix any grammar or spelling errors in this text and improve its clarity while keeping the original meaning.", content, onChunk);
};

/**
 * Change the tone of the text
 */
export const changeTone = async (content: string, tone: 'formal' | 'casual' | 'professional' | 'persuasive', onChunk: (text: string) => void) => {
  return streamGeminiContent(`Please rewrite this text in a ${tone} tone.`, content, onChunk);
};

/**
 * Generate a title for the document
 */
export const generateTitle = async (content: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: `Based on the following content, suggest a short, catchy, and relevant title for the document. Return ONLY the title text.\n\nContent:\n${content}` }] }],
    });
    return response.text?.trim() || "Untitled Document";
  } catch (error) {
    console.error("Gemini Title Generation Error:", error);
    return "Untitled Document";
  }
};
