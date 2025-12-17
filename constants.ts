
import { ModelId, AspectRatio, Resolution, Template } from './types';
import { v4 as uuidv4 } from 'uuid';

export const ASPECT_RATIOS: AspectRatio[] = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:5", "5:4", "3:4", "4:3", "21:9"];
export const RESOLUTIONS: Resolution[] = ["512", "768", "1024", "1536", "2048", "1K", "2K", "4K"];

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  "512": "Standard (512px)",
  "768": "HD (768px)",
  "1024": "Full HD (1024px)",
  "1536": "QHD (1536px)",
  "2048": "4K (2048px)",
  "1K": "1K (Standard)",
  "2K": "2K (High Res)",
  "4K": "4K (Ultra Res)",
};

export const MODEL_DETAILS: Record<ModelId, {
    name: string;
    badge: string;
    badgeColor: string;
    type: 'image' | 'video';
    supportedAspectRatios?: AspectRatio[];
    supportedResolutions?: Resolution[];
}> = {
    'gemini-3-pro-image-preview': { 
        name: 'Nano Banana Pro', 
        badge: 'Google', 
        badgeColor: 'bg-blue-500', 
        type: 'image',
        supportedAspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
        supportedResolutions: ["1K", "2K", "4K"]
    },
    'openai-latest-image': {
        name: 'GPT-Image-1.5',
        badge: 'OpenAI',
        badgeColor: 'bg-green-500',
        type: 'image',
        // OpenAI defaults
        supportedAspectRatios: ["1:1", "16:9", "9:16"], // Approximate
        supportedResolutions: ["1024"]
    },
    'veo-3.1-generate-preview': {
        name: 'Veo 3.1',
        badge: 'Google',
        badgeColor: 'bg-blue-500',
        type: 'video',
        supportedAspectRatios: ['16:9', '9:16'],
        supportedResolutions: ["720p" as any] // Veo specific
    },
    'sora-2-video': {
        name: 'Sora 2',
        badge: 'OpenAI',
        badgeColor: 'bg-green-500',
        type: 'video',
        supportedAspectRatios: ['16:9', '9:16', '1:1'],
        supportedResolutions: ["1280x720" as any] // Sora specific
    },
};


export const DEFAULT_TEMPLATES: Template[] = [
    {
        id: 'social-media-ad',
        name: 'Social Media Ad',
        description: 'Punchy prompt for high engagement.',
        defaultModel: 'gemini-3-pro-image-preview',
        params: {
            prompt: 'Vibrant, eye-catching advertisement for a new brand of sparkling water. Tropical fruits, splashing water, energetic models, dynamic composition, high detail, 8k.',
            aspectRatio: '1:1',
            resolution: '1K',
        },
        createdAt: Date.now(),
        readonly: true,
    },
    {
        id: 'stock-photo',
        name: 'Stock Photo',
        description: 'Natural lighting for realistic scenes.',
        defaultModel: 'gemini-3-pro-image-preview',
        params: {
            prompt: 'A diverse group of colleagues collaborating in a bright, modern office space. Natural light from large windows, plants in the background, candid expressions. Photorealistic, soft focus.',
            aspectRatio: '3:2',
            resolution: '2K',
        },
        createdAt: Date.now(),
        readonly: true,
    },
    {
        id: 'website-graphic',
        name: 'Website Graphic',
        description: 'Minimal, clean graphics for web use.',
        defaultModel: 'openai-latest-image',
        params: {
            prompt: 'Minimalist abstract background, gentle gradients of blue and purple, subtle geometric shapes, clean vector style, suitable for a tech startup website hero section.',
            aspectRatio: '16:9',
            resolution: '1024',
        },
        createdAt: Date.now(),
        readonly: true,
    },
    {
        id: 'product-shot',
        name: 'Product Shot',
        description: 'Studio lighting for commercial products.',
        defaultModel: 'gemini-3-pro-image-preview',
        params: {
            prompt: 'A sleek, modern wireless earbud case on a marble surface. Studio lighting, soft shadows, focused on product texture and detail, minimalist background, commercial photography.',
            aspectRatio: '1:1',
            resolution: '1K',
        },
        createdAt: Date.now(),
        readonly: true,
    },
    {
        id: 'youtube-thumbnail',
        name: 'YouTube Thumbnail',
        description: 'Bold subject, high contrast for clicks.',
        defaultModel: 'gemini-3-pro-image-preview',
        params: {
            prompt: 'Expressive portrait of a gamer reacting with shock and excitement. Neon lighting, high contrast, dramatic shadows, bokeh background with computer screens. Bold colors, designed for a clickable YouTube thumbnail.',
            aspectRatio: '16:9',
            resolution: '2K',
        },
        createdAt: Date.now(),
        readonly: true,
    },
];
