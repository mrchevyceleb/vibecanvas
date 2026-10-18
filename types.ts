import type {
  ActiveModelId,
  AspectRatio,
  Resolution,
} from "./supabase/functions/_shared/falModels";
export type {
  AspectRatio,
  Resolution,
} from "./supabase/functions/_shared/falModels";
export type ModelId = ActiveModelId | "sora-2-video"; // Legacy library records remain readable.

export interface GenParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
  initImageStoragePath?: string;
  initImageBucket?: "images" | "video";
  duration?: string;
  generateAudio?: boolean;
  strength?: number;
  remixVideoId?: string;
  seconds?: "4" | "8" | "12";
  soraSize?: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Template {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  defaultModel: ModelId;
  params: Partial<GenParams>;
  createdAt: number | string;
  readonly?: boolean;
}

export interface ImageRecord {
  id: string;
  user_id?: string;
  model: ModelId;
  params: GenParams;
  templateId?: string;
  promptTextAtGen: string;
  createdAt: number | string;
  storage_path: string;
  thumb_storage_path?: string;
  meta?: Record<string, any>;
  sourceType: "generate" | "upload" | "edit";
  folder_id: string | null;
  mediaType: "image" | "video";
}

export interface GenerateResult {
  images: Array<{ blob: Blob; meta?: any }>;
  params?: GenParams;
  acknowledgeSaved?: () => void;
}

export interface ImageProvider {
  id: ModelId;
  name: string;
  isConfigured: () => boolean;
  supports: {
    img2img: boolean;
    negativePrompt: boolean;
    guidance: boolean;
    steps: boolean;
    seed: boolean;
  };
  generate(
    params: GenParams,
    options?: { signal?: AbortSignal; onStatus?: (message: string) => void },
  ): Promise<GenerateResult>;
}
