import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_TEXT_MODEL, GEMINI_VISION_MODEL } from '../constants';
import { PlantDiagnosis, ImagePart, EncyclopediaEntry, CropInsight, FarmingAdvice, FertPestQuantitiesAIResponse, WeatherData } from '../types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Gemini API Key (VITE_GEMINI_API_KEY) is not set in .env. AI features will not work.");
}

const ai = new GoogleGenAI(API_KEY || "");

const parseJsonFromGeminiResponse = <T,>(text: string): T | { error: string } => {
  let jsonStr = text.trim();
  // Remove code fences if present
  const fenceRegex = /^```(json)?\s*\n?([\s\S]*?)\n?```$/i;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[2]) {
    jsonStr = fenceMatch[2].trim();
  }
  // --- Sanitize: Remove trailing commas before } or ] ---
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
  // Try to extract the first JSON object or array from anywhere in the text
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (objMatch) {
    jsonStr = objMatch[0];
  } else if (arrMatch) {
    jsonStr = arrMatch[0];
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    // As a fallback, try to parse the original text (in case it's pure JSON)
    try {
      return JSON.parse(text) as T;
    } catch (e2) {
      console.error("Failed to parse JSON response:", e, "Original text:", text);
      return { error: `Failed to parse AI response. The response might not be valid JSON.\n---\n${text}` };
    }
  }
};

export const diagnosePlant = async (imageBase64: string, mimeType: string, customPrompt?: string): Promise<PlantDiagnosis> => {
  const defaultReturn: PlantDiagnosis = { condition: "", diseaseName: "", careSuggestions: [], confidenceLevel: "" };
  if (!API_KEY) return { ...defaultReturn, error: "API Key not configured." };
  
  try {
    // If no image and no mimeType, use text model for prompt correction
    if ((!imageBase64 || imageBase64 === '') && (!mimeType || mimeType === '')) {
      const improvedPrompt = customPrompt ? `${customPrompt}\nRewrite the above as a clear, grammatically correct, natural sentence in the same language. If the text is a question, make it a polite, complete question. Do not translate. Do not add extra information.` : '';
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: improvedPrompt,
        config: { responseMimeType: "application/json" }
      });
      const text = (response as any).text || (response as any).candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) return { ...defaultReturn, error: "AI did not return a response." };
      return { ...defaultReturn, condition: text };
    }
    // Otherwise, use vision model for image + prompt
    const imagePart: ImagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64.split(',')[1],
      },
    };
    const basePrompt = `You are a plant health expert. Analyze the attached plant image. Respond ONLY in JSON format with these keys:
1. "plantName": (string, the most likely plant species or common name, e.g., "Mango", "Apple", "Rose". If unknown, say "Unknown").
2. "plantEmoji": (string, a relevant emoji for the plant, e.g., "🥭" for Mango, "🍎" for Apple, "🌹" for Rose, or "🪴" if unknown).
3. "plantConfidencePercent": (number, 0-100, your confidence in the plant identification).
4. "condition": (string, e.g., "Healthy", "Diseased", "Needs Attention", "Unknown").
5. "statusTag": (string, one of "Healthy", "Diseased", "NeedsAttention", "Unknown"). This should correspond to the condition.
6. "diseaseName": (string, specific disease/issue if any, or "N/A").
7. "careSuggestions": (array of strings, practical, actionable tips as bullet points. If "Healthy" or "Unknown", provide general care tips or state "N/A").
8. "confidenceLevel": (string, e.g., "High", "Medium", "Low", or "N/A if not a plant").
9. "confidencePercent": (number, 0-100, your confidence in the disease diagnosis).
Respond with ONLY ONE JSON object. Do NOT return multiple objects or extra text. Do NOT repeat the keys. If the image is not a plant, set plantName to "Unknown", plantEmoji to "🪴", plantConfidencePercent to 0, condition to "Unknown", statusTag to "Unknown", and other relevant fields to "N/A".`;
    const textPart = {
      text: customPrompt ? `${customPrompt} ${basePrompt}` : basePrompt,
    };
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: { parts: [imagePart, textPart] },
      config: { responseMimeType: "application/json" }
    });
    const text = (response as any).text || (response as any).candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return { ...defaultReturn, error: "AI did not return a response." };
    const parsedResult = parseJsonFromGeminiResponse<PlantDiagnosis>(text || "");
    if (!('condition' in parsedResult)) {
      return { ...defaultReturn, error: (parsedResult as { error: string }).error || "AI service returned an unspecified error." };
    }
    const diagnosis = parsedResult as PlantDiagnosis;
    if (typeof diagnosis.careSuggestions === 'string') {
        diagnosis.careSuggestions = diagnosis.careSuggestions.split('\n').map(s => s.trim().replace(/^- /, '')).filter(s => s);
    }
    if (!Array.isArray(diagnosis.careSuggestions)) {
        diagnosis.careSuggestions = diagnosis.careSuggestions ? [String(diagnosis.careSuggestions)] : [];
    }
    if (diagnosis.confidencePercent) diagnosis.confidencePercent = Number(diagnosis.confidencePercent);
    if (diagnosis.plantConfidencePercent) diagnosis.plantConfidencePercent = Number(diagnosis.plantConfidencePercent);
    return diagnosis;
  } catch (error) {
    console.error("Error diagnosing plant:", error);
    return {
      ...defaultReturn,
      error: `Error from AI: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const getEncyclopediaEntry = async (plantName: string): Promise<EncyclopediaEntry> => {
  const defaultReturn: EncyclopediaEntry = { plantName, summary:"", sunlight:"", watering:"", care:"", commonDiseases:""};
  if (!API_KEY) return { ...defaultReturn, error: "API Key not configured."};
  try {
    const prompt = `Provide an encyclopedia-style summary for the plant "${plantName}". Respond ONLY in JSON format with the following keys: "plantName" (string), "summary" (string), "sunlight" (string), "watering" (string), "care" (string), "commonDiseases" (string). If the plant is not found, return an error message under an "error" key, and set other fields to "N/A" or empty strings.`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const parsedResult = parseJsonFromGeminiResponse<EncyclopediaEntry>(response.text || "");
    if (!('summary' in parsedResult)) { // 'summary' is a key in EncyclopediaEntry. If not present, parsedResult is {error: string}
     return { ...defaultReturn, error: (parsedResult as { error: string }).error || "AI service returned an unspecified error." };
    }
    return parsedResult as EncyclopediaEntry;

  } catch (error) {
    console.error("Error fetching encyclopedia entry:", error);
    return { 
      ...defaultReturn,
      error: `Error from AI: ${error instanceof Error ? error.message : String(error)}`, 
    };
  }
};

export const getCropInsights = async (district: string, month: string): Promise<CropInsight> => {
  const defaultReturn: CropInsight = { district, month, suitableCrops:[], tips:"", climatePatterns:"", allCrops:[] };
  if (!API_KEY) return { ...defaultReturn, error: "API Key not configured." };
  try {
    const prompt = `For ${district} district in Karnataka, during the month of ${month}, what are the most suitable crops to grow? Respond ONLY in JSON format with keys: "district" (string), "month" (string), "suitableCrops" (array of strings), "allCrops" (array of all major crops grown in this district/month, not just suitable ones), "tips" (string, general farming tips for these crops in this context), "climatePatterns" (string, typical climate patterns for this district and month).`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const parsedResult = parseJsonFromGeminiResponse<CropInsight>(response.text || "");

    if (!('suitableCrops' in parsedResult)) { // 'suitableCrops' is a key in CropInsight.
      return { ...defaultReturn, error: (parsedResult as { error: string }).error || "AI service returned an unspecified error." };
    }
    // Ensure allCrops is present and is an array
    if (!('allCrops' in parsedResult) || !Array.isArray((parsedResult as any).allCrops)) {
      (parsedResult as any).allCrops = [ ...(parsedResult as any).suitableCrops ];
    }
    return parsedResult as CropInsight;

  } catch (error) {
    console.error("Error fetching crop insights:", error);
     return { 
      ...defaultReturn,
      error: `Error from AI: ${error instanceof Error ? error.message : String(error)}`, 
    };
  }
};

export const getWeatherBasedAdvice = async (weatherJson: string, context: string): Promise<FarmingAdvice> => {
  const defaultReturn: FarmingAdvice = { advice: "" };
  if (!API_KEY) return { ...defaultReturn, error: "API Key not configured." };
  try {
    const prompt = `Given the following weather data for ${context}: ${weatherJson}. You are a strict, highly experienced agricultural advisor. If the crop or farming context is NOT suitable for the current weather, location, or season (for example, rice in a dry region like Sidlaghatta), you must give a very clear, strict, and lengthy warning. Explain in detail why it is not suitable, including water, soil, and climate requirements, and strongly advise the farmer to avoid this crop. Suggest better alternatives if possible. Do NOT sugar-coat or encourage unsuitable choices. If the crop is suitable, provide a detailed, practical, and actionable plan for today. Respond ONLY in JSON format with one key: "advice" (string, at least 5-10 sentences if warning, and always detailed).`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const parsedResult = parseJsonFromGeminiResponse<FarmingAdvice>(response.text || "");

    if (!('advice' in parsedResult)) { // 'advice' is a key in FarmingAdvice.
      return { ...defaultReturn, error: (parsedResult as { error: string }).error || "AI service returned an unspecified error." };
    }
    return parsedResult as FarmingAdvice;
    
  } catch (error) {
    console.error("Error fetching weather-based advice:", error);
    return { 
      ...defaultReturn,
      error: `Error from AI: ${error instanceof Error ? error.message : String(error)}`, 
    };
  }
};

export const generateCaptionForImage = async (imageBase64: string, mimeType: string): Promise<{ caption: string; error?: string }> => {
  if (!API_KEY) return { caption: "", error: "API Key not configured."};
  try {
    const imagePart: ImagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64.split(',')[1],
      },
    };
    const textPart = {
      text: `Generate a fun, engaging, and informative Instagram-style caption for this plant photo. Keep it concise (1-3 sentences). Respond ONLY in JSON format with one key: "caption" (string).`,
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: { parts: [imagePart, textPart] },
      config: { responseMimeType: "application/json" }
    });
    const parsedResult = parseJsonFromGeminiResponse<{caption: string}>(response.text || "");

    if (!('caption' in parsedResult)) {
        // parsedResult is of type { error: string }
        return { caption: "", error: (parsedResult as { error: string }).error || "AI service returned an unspecified error." };
    }
    // If here, parsedResult is of type { caption: string }
    return { caption: parsedResult.caption };

  } catch (error) {
    console.error("Error generating caption:", error);
    return { 
      caption: "",
      error: `Error from AI: ${error instanceof Error ? error.message : String(error)}`, 
    };
  }
};

export const getFertPestQuantitiesAI = async (
  crop: string,
  district: string,
  month: string,
  weather: WeatherData,
  acres: number
): Promise<FertPestQuantitiesAIResponse> => {
  const defaultReturn: FertPestQuantitiesAIResponse = { fertilizers: [], pesticides: [] };
  if (!API_KEY) return { ...defaultReturn, error: "API Key not configured." };
  try {
    const prompt = `You are an expert agricultural advisor. For the following context, recommend the best fertilizers and pesticides for the crop, and specify the recommended quantity per acre (in decimals, not just whole numbers, and in appropriate units like kg or L). Also, calculate the total quantity for ${acres} acres. Respond in JSON as:\n{\n  \"fertilizers\": [{\"name\": \"...\", \"per_acre\": ..., \"unit\": \"...\", \"total\": ...}],\n  \"pesticides\": [{\"name\": \"...\", \"per_acre\": ..., \"unit\": \"...\", \"total\": ...}]\n}\nContext:\nCrop: ${crop}\nDistrict: ${district}\nMonth: ${month}\nWeather: ${JSON.stringify(weather)}\n`;
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const parsedResult = parseJsonFromGeminiResponse<FertPestQuantitiesAIResponse>(response.text || "");
    if (!('fertilizers' in parsedResult) || !('pesticides' in parsedResult)) {
      return { ...defaultReturn, error: (parsedResult as { error: string }).error || "AI service returned an unspecified error." };
    }
    return parsedResult as FertPestQuantitiesAIResponse;
  } catch (error) {
    console.error("Error fetching AI fertilizer/pesticide quantities:", error);
    return {
      ...defaultReturn,
      error: `Error from AI: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
