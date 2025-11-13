// FIX: Added Chat and Content types for createChat function.
import { GoogleGenAI, Type, Modality, Chat, Content } from "@google/genai";
import type { Language, MeditationScript } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const meditationScriptSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'A short, calming title for the meditation session.',
    },
    main_visual_prompt: {
      type: Type.STRING,
      description: 'A single, detailed prompt for an image generator to create one serene, beautiful, photorealistic image that represents the entire mood of the meditation session.',
    },
    segments: {
      type: Type.ARRAY,
      description: 'An array of meditation segments, each with a spoken paragraph.',
      items: {
        type: Type.OBJECT,
        properties: {
          paragraph: {
            type: Type.STRING,
            description: 'The text to be spoken by the narrator for this segment. Should be 2-3 sentences long.',
          },
        },
        required: ['paragraph'],
      },
    },
  },
  required: ['title', 'main_visual_prompt', 'segments'],
};

const getSegmentCountForDuration = (duration: number): number => {
    if (duration <= 1) return 3; // ~1 minute
    if (duration <= 3) return 7; // ~3 minutes
    return 12; // ~5 minutes
}

export const generateMeditationScript = async (prompt: string, language: Language, duration: number): Promise<MeditationScript> => {
  const segmentCount = getSegmentCountForDuration(duration);
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a deeply meaningful and unique guided meditation script based on this prompt: "${prompt}". 
    The script should be in ${language}. 
    Avoid common clichés and ensure the narrative is creative, profound, and not a copy of existing meditations.
    It must be structured into a title, a single main visual prompt for an image generator, and exactly ${segmentCount} distinct segments. 
    Each segment must have a paragraph of text to be spoken. The total spoken time should be approximately ${duration} minute(s).`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: meditationScriptSchema,
    },
  });

  const jsonText = result.text.trim();
  return JSON.parse(jsonText);
};

export const generateSpeech = async (text: string, language: Language): Promise<string> => {
    const prompt = language === 'urdu' ? `Translate this to Urdu and then generate audio: "${text}"` : `Say this with a calm, soothing voice: "${text}"`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' }, // A calm voice
              },
          },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? '';
};


export const generateImage = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Create a serene, beautiful, photorealistic image for a meditation app. The image should be visually stunning and calming. Prompt: ${prompt}`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
    });
    return response.generatedImages[0].image.imageBytes;
};

// FIX: Added editImage function to edit an image based on a prompt for ImageStudio.
export const editImage = async (prompt: string, image: { data: string; mimeType: string }): Promise<string> => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: image.data,
              mimeType: image.mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    throw new Error('No image was generated');
};

// FIX: Added createChat function to initialize a new chat session for the Chat component. Can accept history.
export const createChat = (history?: Content[]): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
        systemInstruction: 'You are Zenith, a personal AI meditation assistant. Your goal is to help users find calm, provide guidance on meditation, and answer questions about mindfulness and well-being in a soothing, supportive, and friendly tone.',
    },
  });
};