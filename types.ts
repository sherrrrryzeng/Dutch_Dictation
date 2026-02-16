
export interface AudioSegment {
  sentence: string;
  startTime: number;
  endTime: number;
}

export interface DictationState {
  segments: AudioSegment[];
  currentIndex: number;
  userInput: string;
  isCorrect: boolean | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  isLoading: boolean;
  statusMessage: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  PRACTICING = 'PRACTICING',
  COMPLETED = 'COMPLETED'
}
