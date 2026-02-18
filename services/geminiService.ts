
import { GoogleGenAI, Type } from "@google/genai";
import { AudioSegment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const transcribeAndSegment = async (audioBase64: string, mimeType: string): Promise<AudioSegment[]> => {
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    You are an expert Dutch language instructor. Your task is to segment this audio into natural, complete sentences for a dictation exercise.
    
    CRITICAL SEGMENTATION RULES:
    1. COMPLETE SENTENCES: A segment should be a single complete Dutch sentence. Do NOT cut sentences into fragments.
    2. 10-SECOND LIMIT: Only split a sentence if it is over 10 seconds. Split ONLY at logical linguistic boundaries like commas or conjunctions.
    3. NUMBERS: All numbers MUST be fully spelled out as words in Dutch (e.g., 'twaalf' instead of '12').
    4. PUNCTUATION: Include proper Dutch punctuation.
    
    CRITICAL TIMING & OVERLAP RULES (FOR ABSOLUTE COMPLETENESS):
    1. START BUFFER: Set 'startTime' approximately 1.0 second BEFORE the first syllable starts. This is crucial to ensure the first word is never cut off.
    2. END BUFFER: Set 'endTime' approximately 2.0 seconds AFTER the last syllable ends. This ensures the full cadence and trailing consonants are captured.
    3. OVERLAP IS MANDATORY: Segments SHOULD overlap with each other. It is better to have the end of the previous sentence audible at the start of the next segment than to miss even one millisecond of the target sentence.
    4. PRECISION: Provide timestamps in seconds with high precision.
    
    Return a JSON array of objects.
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
              sentence: { type: Type.STRING, description: "The full Dutch sentence or natural phrase." },
              startTime: { type: Type.NUMBER, description: "Start time in seconds with 1.0s pre-roll." },
              endTime: { type: Type.NUMBER, description: "End time in seconds with 2.0s post-roll." }
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
