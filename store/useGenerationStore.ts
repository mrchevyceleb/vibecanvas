import { create } from "zustand";
import { GenParams, ImageRecord, ModelId } from "../types";
interface GenerationState {
  isGenerating: boolean;
  progress: number;
  statusMessage: string | null;
  results: ImageRecord[];
  error: string | null;
  recoveryLinks: { url: string; name: string }[];
  runId: number;
  controller: AbortController | null;
  startedAt: number | null;
  activeModels: ModelId[];
  statuses: Record<string, string>;
  retryRequest: {
    params: GenParams;
    mode: "image" | "video";
    models: ModelId[];
    runId: number;
  } | null;
  startGeneration: (
    models?: ModelId[],
  ) => { runId: number; signal: AbortSignal } | null;
  setGenerationProgress: (progress: number) => void;
  setGenerationStatus: (
    message: string,
    model?: ModelId,
    runId?: number,
  ) => void;
  setGenerationSuccess: (results: ImageRecord[], runId?: number) => void;
  setGenerationError: (error: string, runId?: number) => void;
  clearResults: () => void;
  cancelGeneration: () => void;
  reset: () => void;
}
export const useGenerationStore = create<GenerationState>((set, get) => ({
  isGenerating: false,
  progress: 0,
  statusMessage: null,
  results: [],
  error: null,
  recoveryLinks: [],
  runId: 0,
  controller: null,
  startedAt: null,
  activeModels: [],
  statuses: {},
  retryRequest: null,
  startGeneration: (activeModels = []) => {
    if (get().isGenerating) return null;
    const controller = new AbortController(),
      runId = get().runId + 1;
    set({
      isGenerating: true,
      runId,
      controller,
      startedAt: Date.now(),
      activeModels,
      results: [],
      statuses: {},
      error: null,
      recoveryLinks: [],
      statusMessage: "Submitting your request…",
      progress: 0,
    });
    return { runId, signal: controller.signal };
  },
  setGenerationProgress: (progress) => set({ progress }),
  setGenerationStatus: (statusMessage, model, runId) => {
    if (!get().isGenerating || (runId !== undefined && runId !== get().runId))
      return;
    set((state) => ({
      statusMessage,
      statuses: model
        ? { ...state.statuses, [model]: statusMessage }
        : state.statuses,
    }));
  },
  setGenerationSuccess: (results, runId) => {
    if (runId !== undefined && (runId !== get().runId || !get().isGenerating))
      return;
    set({
      isGenerating: false,
      results,
      progress: 100,
      statusMessage: "Saved to your library",
      controller: null,
      error: null,
    });
  },
  setGenerationError: (error, runId) => {
    if (runId !== undefined && (runId !== get().runId || !get().isGenerating))
      return;
    set({ isGenerating: false, error, controller: null, statusMessage: null });
  },
  clearResults: () => {
    if (!get().isGenerating)
      set({
        results: [],
        error: null,
        recoveryLinks: [],
        statusMessage: null,
        retryRequest: null,
      });
  },
  cancelGeneration: () => {
    get().controller?.abort();
    set({
      isGenerating: false,
      controller: null,
      runId: get().runId + 1,
      progress: 0,
      error:
        "Stopped waiting. Cancellation requested; a request already rendering may still be charged.",
      statusMessage: null,
    });
  },
  reset: () => {
    get().controller?.abort();
    set({
      isGenerating: false,
      controller: null,
      runId: get().runId + 1,
      results: [],
      error: null,
      recoveryLinks: [],
      statusMessage: null,
      activeModels: [],
      statuses: {},
      retryRequest: null,
    });
  },
}));
