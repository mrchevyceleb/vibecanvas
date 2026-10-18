import { AspectRatio, Resolution, Template } from "./types";
import { FAL_MODELS, FalModel } from "./supabase/functions/_shared/falModels";
export const ASPECT_RATIOS: AspectRatio[] = [
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
export const RESOLUTIONS: Resolution[] = [
  "512",
  "768",
  "1024",
  "1536",
  "2048",
  "1K",
  "2K",
  "4K",
];
export const RESOLUTION_LABELS: Record<Resolution, string> = {
  "512": "512 px",
  "768": "768 px",
  "1024": "1024 px",
  "1536": "1536 px",
  "2048": "2048 px",
  "1K": "1K",
  "2K": "2K",
  "4K": "4K",
  "720p": "720p",
  "1080p": "1080p",
  "768p": "768p",
};
export const MODEL_DETAILS: Record<string, FalModel> = {
  ...FAL_MODELS,
  "sora-2-video": {
    ...FAL_MODELS["veo-3.1-generate-preview"],
    name: "Sora 2 (archived)",
    badge: "OpenAI",
  },
};

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "social-media-ad",
    name: "Social Media Ad",
    description: "Punchy prompt for high engagement.",
    defaultModel: "gemini-3.1-flash-image-preview",
    params: {
      prompt:
        "Vibrant, eye-catching advertisement for a new brand of sparkling water. Tropical fruits, splashing water, energetic models, dynamic composition, high detail, 8k.",
      aspectRatio: "1:1",
      resolution: "1K",
    },
    createdAt: Date.now(),
    readonly: true,
  },
  {
    id: "stock-photo",
    name: "Stock Photo",
    description: "Natural lighting for realistic scenes.",
    defaultModel: "gemini-3.1-flash-image-preview",
    params: {
      prompt:
        "A diverse group of colleagues collaborating in a bright, modern office space. Natural light from large windows, plants in the background, candid expressions. Photorealistic, soft focus.",
      aspectRatio: "3:2",
      resolution: "2K",
    },
    createdAt: Date.now(),
    readonly: true,
  },
  {
    id: "website-graphic",
    name: "Website Graphic",
    description: "Minimal, clean graphics for web use.",
    defaultModel: "gpt-image-2.5-flare",
    params: {
      prompt:
        "Minimalist abstract background, gentle gradients of blue and purple, subtle geometric shapes, clean vector style, suitable for a tech startup website hero section.",
      aspectRatio: "3:2",
      resolution: "1K",
    },
    createdAt: Date.now(),
    readonly: true,
  },
  {
    id: "product-shot",
    name: "Product Shot",
    description: "Studio lighting for commercial products.",
    defaultModel: "gemini-3.1-flash-image-preview",
    params: {
      prompt:
        "A sleek, modern wireless earbud case on a marble surface. Studio lighting, soft shadows, focused on product texture and detail, minimalist background, commercial photography.",
      aspectRatio: "1:1",
      resolution: "1K",
    },
    createdAt: Date.now(),
    readonly: true,
  },
  {
    id: "youtube-thumbnail",
    name: "YouTube Thumbnail",
    description: "Bold subject, high contrast for clicks.",
    defaultModel: "gemini-3.1-flash-image-preview",
    params: {
      prompt:
        "Expressive portrait of a gamer reacting with shock and excitement. Neon lighting, high contrast, dramatic shadows, bokeh background with computer screens. Bold colors, designed for a clickable YouTube thumbnail.",
      aspectRatio: "16:9",
      resolution: "2K",
    },
    createdAt: Date.now(),
    readonly: true,
  },
];
