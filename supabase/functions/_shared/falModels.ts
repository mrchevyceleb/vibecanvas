// Shared by the UI and edge function: one source of truth for fal capabilities.
export type AspectRatio =
  | "1:1"
  | "3:2"
  | "2:3"
  | "16:9"
  | "9:16"
  | "4:5"
  | "5:4"
  | "3:4"
  | "4:3"
  | "21:9";
export type Resolution =
  | "512"
  | "768"
  | "1024"
  | "1536"
  | "2048"
  | "1K"
  | "2K"
  | "4K"
  | "720p"
  | "1080p"
  | "768p";
export interface FalModel {
  name: string;
  badge: string;
  badgeColor: string;
  type: "image" | "video";
  description: string;
  tag: string;
  endpoint: string;
  editEndpoint?: string;
  videoEndpoint?: string;
  input:
    | "banana"
    | "gpt"
    | "gpt25"
    | "size"
    | "veo"
    | "kling"
    | "wan"
    | "hailuo"
    | "pixverse";
  supportedAspectRatios: AspectRatio[];
  supportedResolutions: Resolution[];
  durations?: string[];
  videoDurations?: string[];
  negativePrompt?: boolean;
  seed?: boolean;
  audio?: boolean;
  sourceControlsAspect?: boolean;
  fixedResolution?: boolean;
}
const ratios: AspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "21:9",
];
const videoRatios: AspectRatio[] = ["16:9", "9:16"];
export const FAL_MODELS = {
  "gemini-3.1-flash-image-preview": {
    name: "Nano Banana 2",
    badge: "Google",
    badgeColor: "bg-blue-500",
    type: "image",
    description: "A versatile starting point. Fast images and precise edits.",
    tag: "All-rounder",
    endpoint: "fal-ai/nano-banana-2",
    editEndpoint: "fal-ai/nano-banana-2/edit",
    input: "banana",
    supportedAspectRatios: ratios,
    supportedResolutions: ["1K", "2K", "4K"],
    seed: true,
  },
  "nano-banana-pro": {
    name: "Nano Banana Pro",
    badge: "Google",
    badgeColor: "bg-blue-500",
    type: "image",
    description: "Detailed compositions and high-resolution creative work.",
    tag: "Detail",
    endpoint: "fal-ai/nano-banana-pro",
    editEndpoint: "fal-ai/nano-banana-pro/edit",
    input: "banana",
    supportedAspectRatios: ratios,
    supportedResolutions: ["1K", "2K", "4K"],
    seed: true,
  },
  "gpt-image-2.5-flare": {
    name: "GPT Image 2.5 Flare",
    badge: "OpenAI",
    badgeColor: "bg-emerald-500",
    type: "image",
    description:
      "OpenAI’s latest, with fast generation and detailed image edits.",
    tag: "Latest · Fast",
    endpoint: "openai/gpt-image-2.5/flare/text-to-image",
    editEndpoint: "openai/gpt-image-2.5/flare/edit",
    input: "gpt25",
    supportedAspectRatios: ratios,
    supportedResolutions: ["1K", "2K"],
  },
  "gpt-image-2.5-sunburst": {
    name: "GPT Image 2.5 Sunburst",
    badge: "OpenAI",
    badgeColor: "bg-emerald-500",
    type: "image",
    description: "OpenAI’s latest, for precise edits and complex compositions.",
    tag: "Latest · Precision",
    endpoint: "openai/gpt-image-2.5/sunburst/text-to-image",
    editEndpoint: "openai/gpt-image-2.5/sunburst/edit",
    input: "gpt25",
    supportedAspectRatios: ratios,
    supportedResolutions: ["1K", "2K"],
  },
  "openai-latest-image": {
    name: "GPT Image 1.5",
    badge: "OpenAI",
    badgeColor: "bg-emerald-500",
    type: "image",
    description: "Strong prompt following, design, and image editing.",
    tag: "Previous generation",
    endpoint: "fal-ai/gpt-image-1.5",
    editEndpoint: "fal-ai/gpt-image-1.5/edit",
    input: "gpt",
    supportedAspectRatios: ["1:1", "3:2", "2:3"],
    supportedResolutions: ["1024"],
  },
  "flux-schnell": {
    name: "FLUX Schnell",
    badge: "Black Forest Labs",
    badgeColor: "bg-orange-500",
    type: "image",
    description: "Quick drafts for exploring lots of visual directions.",
    tag: "Fast drafts",
    endpoint: "fal-ai/flux/schnell",
    input: "size",
    supportedAspectRatios: ratios,
    supportedResolutions: ["512", "1024"],
    seed: true,
  },
  "flux-2": {
    name: "FLUX.2",
    badge: "Black Forest Labs",
    badgeColor: "bg-orange-500",
    type: "image",
    description: "Realistic textures and flexible reference-image editing.",
    tag: "Realism",
    endpoint: "fal-ai/flux-2",
    editEndpoint: "fal-ai/flux-2/edit",
    input: "size",
    supportedAspectRatios: ratios,
    supportedResolutions: ["1024"],
    seed: true,
  },
  "seedream-4.5": {
    name: "Seedream 4.5",
    badge: "ByteDance",
    badgeColor: "bg-rose-500",
    type: "image",
    description: "High-resolution imagery and consistent visual edits.",
    tag: "High resolution",
    endpoint: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    editEndpoint: "fal-ai/bytedance/seedream/v4.5/edit",
    input: "size",
    supportedAspectRatios: ratios,
    supportedResolutions: ["2K", "4K"],
    seed: true,
  },
  "ideogram-3": {
    name: "Ideogram 3",
    badge: "Ideogram",
    badgeColor: "bg-violet-500",
    type: "image",
    description: "Typography, posters, logos, and graphic compositions.",
    tag: "Typography",
    endpoint: "fal-ai/ideogram/v3",
    input: "size",
    supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    supportedResolutions: ["1024"],
    negativePrompt: true,
    seed: true,
  },
  "qwen-image": {
    name: "Qwen Image",
    badge: "Alibaba",
    badgeColor: "bg-purple-500",
    type: "image",
    description: "Illustrations, rich scenes, and text in your images.",
    tag: "Illustration",
    endpoint: "fal-ai/qwen-image",
    input: "size",
    supportedAspectRatios: ratios,
    supportedResolutions: ["1024"],
    negativePrompt: true,
    seed: true,
  },
  "veo-3.1-generate-preview": {
    name: "Veo 3.1",
    badge: "Google",
    badgeColor: "bg-blue-500",
    type: "video",
    description: "Cinematic clips with generated sound and dialogue.",
    tag: "Cinematic",
    endpoint: "fal-ai/veo3.1",
    editEndpoint: "fal-ai/veo3.1/image-to-video",
    input: "veo",
    supportedAspectRatios: videoRatios,
    supportedResolutions: ["720p", "1080p"],
    durations: ["4", "6", "8"],
    negativePrompt: true,
    seed: true,
    audio: true,
  },
  "veo-3.1-fast": {
    name: "Veo 3.1 Fast",
    badge: "Google",
    badgeColor: "bg-blue-500",
    type: "video",
    description: "Faster video exploration with optional generated audio.",
    tag: "Fast",
    endpoint: "fal-ai/veo3.1/fast",
    editEndpoint: "fal-ai/veo3.1/fast/image-to-video",
    input: "veo",
    supportedAspectRatios: videoRatios,
    supportedResolutions: ["720p", "1080p"],
    durations: ["4", "6", "8"],
    negativePrompt: true,
    seed: true,
    audio: true,
  },
  "kling-2.6": {
    name: "Kling 2.6",
    badge: "Kling",
    badgeColor: "bg-teal-500",
    type: "video",
    description: "Expressive motion, realistic subjects, and native audio.",
    tag: "Motion",
    endpoint: "fal-ai/kling-video/v2.6/pro/text-to-video",
    editEndpoint: "fal-ai/kling-video/v2.6/pro/image-to-video",
    input: "kling",
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportedResolutions: ["1080p"],
    durations: ["5", "10"],
    negativePrompt: true,
    audio: true,
    sourceControlsAspect: true,
    fixedResolution: true,
  },
  "wan-2.6": {
    name: "Wan 2.6",
    badge: "Alibaba",
    badgeColor: "bg-purple-500",
    type: "video",
    description: "Longer clips, multi-shot scenes, and video references.",
    tag: "Longer clips",
    endpoint: "wan/v2.6/text-to-video",
    editEndpoint: "wan/v2.6/image-to-video",
    videoEndpoint: "wan/v2.6/reference-to-video",
    input: "wan",
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supportedResolutions: ["720p", "1080p"],
    durations: ["5", "10", "15"],
    videoDurations: ["5", "10"],
    negativePrompt: true,
    seed: true,
    sourceControlsAspect: true,
  },
  "hailuo-02": {
    name: "Hailuo 02",
    badge: "MiniMax",
    badgeColor: "bg-amber-500",
    type: "video",
    description: "Fluid character movement and imaginative scenes.",
    tag: "Characters",
    endpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    editEndpoint: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    input: "hailuo",
    supportedAspectRatios: ["16:9"],
    supportedResolutions: ["768p"],
    durations: ["6", "10"],
    sourceControlsAspect: true,
    fixedResolution: true,
  },
  "pixverse-5.5": {
    name: "PixVerse 5.5",
    badge: "PixVerse",
    badgeColor: "bg-pink-500",
    type: "video",
    description: "Stylized clips and animation with optional sound.",
    tag: "Stylized",
    endpoint: "fal-ai/pixverse/v5.5/text-to-video",
    editEndpoint: "fal-ai/pixverse/v5.5/image-to-video",
    input: "pixverse",
    supportedAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supportedResolutions: ["720p", "1080p"],
    durations: ["5", "8", "10"],
    negativePrompt: true,
    seed: true,
    audio: true,
    sourceControlsAspect: true,
  },
} satisfies Record<string, FalModel>;
export type ActiveModelId = keyof typeof FAL_MODELS;
export const getFalModel = (id: string): FalModel | undefined =>
  Object.hasOwn(FAL_MODELS, id) ? FAL_MODELS[id as ActiveModelId] : undefined;
export const normalizeModelId = (id: string): ActiveModelId =>
  getFalModel(id)
    ? (id as ActiveModelId)
    : id === "sora-2-video"
      ? "veo-3.1-generate-preview"
      : "gemini-3.1-flash-image-preview";

export interface FalParams {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  negativePrompt?: string;
  duration?: string;
  seed?: number;
  generateAudio?: boolean;
  initImageStoragePath?: string;
  initImageBucket?: "images" | "video";
}
export function normalizeParams(model: FalModel, params: FalParams): FalParams {
  const durations =
    params.initImageBucket === "video" ? model.videoDurations : model.durations;
  let duration = durations?.includes(params.duration || "")
    ? params.duration
    : durations?.[0];
  const resolution = model.supportedResolutions.includes(params.resolution)
    ? params.resolution
    : model.supportedResolutions[0];
  if (model.input === "pixverse" && resolution === "1080p" && duration === "10")
    duration = "8";
  return {
    prompt: params.prompt.trim(),
    aspectRatio: model.supportedAspectRatios.includes(params.aspectRatio)
      ? params.aspectRatio
      : model.supportedAspectRatios[0],
    resolution,
    duration,
    negativePrompt: model.negativePrompt
      ? params.negativePrompt?.trim()
      : undefined,
    seed:
      model.seed &&
      Number.isInteger(params.seed) &&
      params.seed! >= 0 &&
      params.seed! <= 2147483647
        ? params.seed
        : undefined,
    generateAudio: model.audio ? (params.generateAudio ?? true) : undefined,
    initImageStoragePath: params.initImageStoragePath,
    initImageBucket: params.initImageStoragePath
      ? params.initImageBucket || "images"
      : undefined,
  };
}
export function buildFalInput(
  model: FalModel,
  params: FalParams,
  sourceUrl?: string,
) {
  if (sourceUrl && !model.editEndpoint)
    throw new Error(`${model.name} does not support a reference image.`);
  if (sourceUrl && params.initImageBucket === "video" && !model.videoEndpoint)
    throw new Error(`${model.name} does not support a video reference.`);
  const p = normalizeParams(model, params);
  const input: Record<string, unknown> = { prompt: p.prompt };
  if (model.type === "image") {
    if (model.input === "banana") {
      input.aspect_ratio = p.aspectRatio;
      input.resolution = p.resolution;
      input.num_images = 1;
    } else if (model.input === "gpt25") {
      const [w, h] = p.aspectRatio.split(":").map(Number);
      const edge = p.resolution === "2K" ? 2048 : 1024;
      const width = Math.round((edge * w) / Math.max(w, h) / 16) * 16;
      const height = Math.round((edge * h) / Math.max(w, h) / 16) * 16;
      // GPT Image 2.5 requires at least 655,360 pixels, including wide images.
      const scale = Math.max(1, Math.sqrt(655360 / (width * height)));
      input.image_size = {
        width: Math.ceil((width * scale) / 16) * 16,
        height: Math.ceil((height * scale) / 16) * 16,
      };
      input.quality = "high";
      input.num_images = 1;
    } else if (model.input === "gpt") {
      input.image_size =
        p.aspectRatio === "3:2"
          ? "1536x1024"
          : p.aspectRatio === "2:3"
            ? "1024x1536"
            : "1024x1024";
      input.num_images = 1;
    } else {
      const [w, h] = p.aspectRatio.split(":").map(Number);
      const edge =
        p.resolution === "4K"
          ? 4096
          : p.resolution === "2K"
            ? 2048
            : Number(p.resolution);
      input.image_size = {
        width: Math.round((w >= h ? edge : (edge * w) / h) / 32) * 32,
        height: Math.round((h >= w ? edge : (edge * h) / w) / 32) * 32,
      };
      // Seedream requires at least 3.6 megapixels; preserve aspect at 2K.
      if (model.endpoint.includes("seedream") && p.resolution === "2K") {
        const scale = Math.max(
          1,
          Math.sqrt(
            3686400 /
              ((input.image_size as any).width *
                (input.image_size as any).height),
          ),
        );
        input.image_size = {
          width: Math.ceil(((input.image_size as any).width * scale) / 32) * 32,
          height:
            Math.ceil(((input.image_size as any).height * scale) / 32) * 32,
        };
      }
      input.num_images = 1;
    }
    if (
      !model.endpoint.includes("ideogram") &&
      !model.endpoint.includes("seedream")
    )
      input.output_format = "png";
    if (sourceUrl) input.image_urls = [sourceUrl];
  } else {
    input.duration = model.input === "veo" ? `${p.duration}s` : p.duration;
    if (
      model.input !== "hailuo" &&
      (!sourceUrl ||
        !model.sourceControlsAspect ||
        p.initImageBucket === "video")
    )
      input.aspect_ratio = p.aspectRatio;
    if (!model.fixedResolution) input.resolution = p.resolution;
    if (model.audio)
      input[
        model.input === "pixverse" ? "generate_audio_switch" : "generate_audio"
      ] = p.generateAudio;
    if (sourceUrl)
      input[
        p.initImageBucket === "video"
          ? "video_urls"
          : model.input === "kling"
            ? "start_image_url"
            : "image_url"
      ] = p.initImageBucket === "video" ? [sourceUrl] : sourceUrl;
  }
  if (p.negativePrompt) input.negative_prompt = p.negativePrompt;
  if (p.seed !== undefined) input.seed = p.seed;
  return {
    endpoint: sourceUrl
      ? p.initImageBucket === "video"
        ? model.videoEndpoint!
        : model.editEndpoint!
      : model.endpoint,
    input,
    params: p,
  };
}
