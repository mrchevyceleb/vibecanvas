
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ModelId, AspectRatio, Resolution } from '../types';

interface SettingsState {
  modelId: ModelId;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  soraSeconds: "4" | "8" | "12";
  soraSize: string;
  setModelId: (modelId: ModelId) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  setResolution: (resolution: Resolution) => void;
  setSoraSeconds: (seconds: "4" | "8" | "12") => void;
  setSoraSize: (size: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelId: 'gemini-3-pro-image-preview',
      aspectRatio: '1:1',
      resolution: '1024',
      soraSeconds: "4",
      soraSize: "1280x720",
      setModelId: (modelId) => set({ modelId }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setResolution: (resolution) => set({ resolution }),
      setSoraSeconds: (soraSeconds) => set({ soraSeconds }),
      setSoraSize: (soraSize) => set({ soraSize }),
    }),
    {
      name: 'settings:v1',
    }
  )
);
