
import { create } from 'zustand';
import { ImageRecord } from '../types';

interface GenerationState {
  isGenerating: boolean;
  progress: number;
  statusMessage: string | null;
  results: ImageRecord[];
  error: string | null;
  startGeneration: () => void;
  setGenerationProgress: (progress: number) => void;
  setGenerationStatus: (message: string) => void;
  setGenerationSuccess: (results: ImageRecord[]) => void;
  setGenerationError: (error: string) => void;
  clearResults: () => void;
  cancelGeneration: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  isGenerating: false,
  progress: 0,
  statusMessage: null,
  results: [],
  error: null,
  startGeneration: () => set({ isGenerating: true, progress: 0, statusMessage: 'Initializing...', error: null, results: [] }),
  setGenerationProgress: (progress) => set({ progress }),
  setGenerationStatus: (statusMessage) => set({ statusMessage }),
  setGenerationSuccess: (results) => set({ isGenerating: false, results, progress: 100, statusMessage: 'Done!' }),
  setGenerationError: (error) => set({ isGenerating: false, error, results: [], statusMessage: null }),
  clearResults: () => set({ results: [], error: null, statusMessage: null }),
  cancelGeneration: () => set({ isGenerating: false, progress: 0, error: 'Generation cancelled.', statusMessage: null }),
}));
