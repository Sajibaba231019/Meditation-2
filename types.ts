export interface MeditationSegment {
  paragraph: string;
}

export interface MeditationScript {
  title: string;
  main_visual_prompt: string;
  segments: MeditationSegment[];
}

export type Language = 'english' | 'urdu';

export interface HistoryItem {
  id: number;
  script: MeditationScript;
  imageUrl: string;
  audioWavBase64: string;
}

// FIX: Added TabInfo interface for use in constants.ts
export interface TabInfo {
  id: string;
  title: string;
  icon: string;
}

// FIX: Added ChatMessage interface for use in Chat.tsx
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}