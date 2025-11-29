
export type ModelId =
  | 'gemini-3-pro-image-preview'
  | 'openai-latest-image'
  | 'veo-3.1-generate-preview'
  | 'sora-2-video';

export type AspectRatio = "1:1" | "3:2" | "2:3" | "16:9" | "9:16" | "4:5" | "21:9";
export type Resolution = "512" | "768" | "1024" | "1536" | "2048";

export interface GenParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
  initImageStoragePath?: string;
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
  mediaType: 'image' | 'video';
}

export interface GenerateResult {
  images: Array<{ blob: Blob; meta?: any }>;
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
  generate(params: GenParams): Promise<GenerateResult>;
}
