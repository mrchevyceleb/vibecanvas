import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ModelId, AspectRatio, Resolution } from "../types";
import {
  getFalModel,
  normalizeModelId,
} from "../supabase/functions/_shared/falModels";
interface SettingsState {
  modelId: ModelId;
  imageModelId: ModelId;
  videoModelId: ModelId;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  duration: string;
  generateAudio: boolean;
  soraSeconds: "4" | "8" | "12";
  soraSize: string;
  setModelId: (id: ModelId) => void;
  setAspectRatio: (value: AspectRatio) => void;
  setResolution: (value: Resolution) => void;
  setDuration: (value: string) => void;
  setGenerateAudio: (value: boolean) => void;
  setSoraSeconds: (value: "4" | "8" | "12") => void;
  setSoraSize: (value: string) => void;
}
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelId: "gemini-3.1-flash-image-preview",
      imageModelId: "gemini-3.1-flash-image-preview",
      videoModelId: "veo-3.1-generate-preview",
      aspectRatio: "1:1",
      resolution: "1K",
      duration: "4",
      generateAudio: true,
      soraSeconds: "4",
      soraSize: "1280x720",
      setModelId: (id) => {
        const modelId = normalizeModelId(id),
          model = getFalModel(modelId)!;
        set((state) => ({
          modelId,
          [model.type === "image" ? "imageModelId" : "videoModelId"]: modelId,
          aspectRatio: model.supportedAspectRatios.includes(state.aspectRatio)
            ? state.aspectRatio
            : model.supportedAspectRatios[0],
          resolution: model.supportedResolutions.includes(state.resolution)
            ? state.resolution
            : model.supportedResolutions[0],
          duration: model.durations?.includes(state.duration)
            ? state.duration
            : model.durations?.[0] || state.duration,
        }));
      },
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setResolution: (resolution) => set({ resolution }),
      setDuration: (duration) => set({ duration }),
      setGenerateAudio: (generateAudio) => set({ generateAudio }),
      setSoraSeconds: (soraSeconds) => set({ soraSeconds }),
      setSoraSize: (soraSize) => set({ soraSize }),
    }),
    {
      name: "settings:v1",
      version: 3,
      migrate: (old: any, version) => {
        const prior =
          version < 2
            ? {
                ...old,
                modelId: normalizeModelId(old.modelId),
                imageModelId:
                  getFalModel(old.modelId)?.type === "image"
                    ? old.modelId
                    : "gemini-3.1-flash-image-preview",
                videoModelId: "veo-3.1-generate-preview",
                duration: old.soraSeconds || "4",
                generateAudio: true,
              }
            : old;
        const upgradeImage = (id: string) =>
          id === "openai-latest-image"
            ? "gpt-image-2.5-flare"
            : normalizeModelId(id);
        return {
          ...prior,
          modelId: upgradeImage(prior.modelId),
          imageModelId: upgradeImage(prior.imageModelId),
          videoModelId: normalizeModelId(prior.videoModelId),
        };
      },
    },
  ),
);
