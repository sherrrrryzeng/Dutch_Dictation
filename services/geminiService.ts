
import { GoogleGenAI, Type } from "@google/genai";
import { AudioSegment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const transcribeAndSegment = async (audioBase64: string, mimeType: string): Promise<AudioSegment[]> => {
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    You are an expert Dutch language instructor. 
    Transcribe the provided Dutch audio and break it down into natural individual sentences. 
    
    CRITICAL INSTRUCTIONS FOR TIMESTAMPS:
    1. Provide high-precision start and end timestamps in seconds (e.g., 12.45).
    2. Ensure the end timestamp (endTime) is slightly generous (add about 0.3-0.5 seconds of padding) to ensure the final word or syllable of the sentence is NOT cut off.
    3. The segments should cover the entire audio without skipping words.
    
    The response must be a JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: audioBase64 } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sentence: { type: Type.STRING, description: "The Dutch sentence text." },
              startTime: { type: Type.NUMBER, description: "Start time in seconds." },
              endTime: { type: Type.NUMBER, description: "End time in seconds." }
            },
            required: ["sentence", "startTime", "endTime"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result as AudioSegment[];
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw new Error("Failed to transcribe audio. Please try a shorter clip or different file.");
  }
};
