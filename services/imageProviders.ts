
import { ModelId, ImageProvider, GenParams, GenerateResult, AspectRatio } from '../types';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../lib/utils';
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase/client';
import { useGenerationStore } from '../store/useGenerationStore';
import { toast } from '../components/ui/Toaster';

// --- Helper function to create a placeholder image blob ---
const createPlaceholderBlob = async (prompt: string): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#cccccc';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        
        const words = prompt.split(' ');
        let line = '';
        let y = 50;
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > 480 && n > 0) {
                ctx.fillText(line, 256, y);
                line = words[n] + ' ';
                y += 25;
            }
            else {
                line = testLine;
            }
        }
        ctx.fillText(line, 256, y);
    }
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
};

export const ensureApiKeySelected = async () => {
     if ((window as any).aistudio) {
         const hasKey = await (window as any).aistudio.hasSelectedApiKey();
         if (!hasKey) {
             const success = await (window as any).aistudio.openSelectKey();
             if (!success) {
                 throw new Error("API Key selection is required.");
             }
         }
    }
}

const geminiProImageProvider: ImageProvider = {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    // Allow if we have an env key OR if we are in AI Studio where we can select one
    isConfigured: () => !!process.env.API_KEY || !!(window as any).aistudio,
    supports: {
        img2img: true,
        negativePrompt: false,
        guidance: false,
        steps: false,
        seed: false,
    },
    async generate(params: GenParams): Promise<GenerateResult> {
        const generateWithRetry = async (retry: boolean): Promise<GenerateResult> => {
            await ensureApiKeySelected();

            if (!process.env.API_KEY && !(window as any).aistudio) {
                throw new Error('Gemini provider is not configured. Ensure API_KEY is available in environment.');
            }

            // Use the key if available. If in AI Studio, ensureApiKeySelected should have handled it.
            // If process.env.API_KEY is still missing here in a non-AI Studio env, it will fail below.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            const parts: any[] = [];
            
            // Add user-provided init image first, if it exists
            if (params.initImageStoragePath) {
                const { data: imageBlob, error } = await supabase.storage.from('images').download(params.initImageStoragePath);
                if (error || !imageBlob) {
                    throw new Error('Initial image not found in storage.');
                }
                const base64Data = await blobToBase64(imageBlob);
                parts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: imageBlob.type || 'image/png',
                    },
                });
            }
            
            parts.push({ text: params.prompt });

            let imageSize: "1K" | "2K" = "1K";
            if (['1536', '2048'].includes(params.resolution)) {
                imageSize = "2K";
            }
            
            let supportedAspectRatio = params.aspectRatio;
            const ratioMap: Record<string, string> = {
                '3:2': '4:3',
                '2:3': '3:4',
                '4:5': '3:4',
                '21:9': '16:9'
            };
            if (params.aspectRatio in ratioMap) {
                supportedAspectRatio = ratioMap[params.aspectRatio] as AspectRatio;
            }

            const allowedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
            if (!allowedRatios.includes(supportedAspectRatio)) {
                supportedAspectRatio = '1:1';
            }

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: { parts: parts },
                    config: {
                        imageConfig: {
                            aspectRatio: supportedAspectRatio as any,
                            imageSize: imageSize,
                        },
                    },
                });

                if (!useGenerationStore.getState().isGenerating) throw new Error('Generation cancelled.');

                const images: { blob: Blob; meta?: any }[] = [];
                if (response.candidates && response.candidates.length > 0) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const base64ImageBytes: string = part.inlineData.data;
                            const blob = await (await fetch(`data:image/png;base64,${base64ImageBytes}`)).blob();
                            images.push({ blob, meta: { modelUsed: 'gemini-3-pro-image-preview' } });
                        }
                    }
                }
                
                if (images.length === 0) {
                    const blockReason = response.candidates?.[0]?.finishReason;
                    if (blockReason === 'SAFETY' || blockReason === 'OTHER') {
                        throw new Error(`Image generation was blocked due to: ${blockReason}. Prompt may have violated safety policies.`);
                    }
                    throw new Error('No image was generated. The model may not have returned an image.');
                }

                return { images };
            } catch (error: any) {
                console.error("Gemini API Error:", error);
                const msg = error.message?.toLowerCase() || '';
                
                // Only treat as key error if explicit. 
                // Generic 400s (INVALID_ARGUMENT) should bubble up with their specific message.
                const isKeyError = msg.includes("api key") || msg.includes("requested entity was not found") || msg.includes("403");
                
                if (retry && (window as any).aistudio && isKeyError) {
                     console.warn("API Key invalid or expired. Prompting re-selection.");
                     toast("Invalid API Key. Please select a valid Paid API key.", "error");
                     await (window as any).aistudio.openSelectKey();
                     return generateWithRetry(false);
                }
                
                if (isKeyError) {
                    throw new Error("API Key not valid. Please ensure you have selected a valid API key associated with a billing project.");
                }
                
                throw error;
            }
        };
        
        return generateWithRetry(true);
    },
};

const openaiProvider: ImageProvider = {
    id: 'openai-latest-image',
    name: 'GPT-Image-1',
    isConfigured: () => true,
    supports: {
        img2img: false,
        negativePrompt: false,
        guidance: false,
        steps: false,
        seed: false,
    },
    async generate(params: GenParams): Promise<GenerateResult> {
        const { setGenerationStatus } = useGenerationStore.getState();
        setGenerationStatus('Requesting image from OpenAI...');
        
        const { data, error } = await supabase.functions.invoke('open-ai-image', {
            body: { 
                prompt: params.prompt,
                aspectRatio: params.aspectRatio,
                resolution: params.resolution
            },
        });

        if (error) {
            console.error("Edge Function Error Object:", error);
            let errorMessage = error.message;

            if (error && typeof error === 'object' && 'context' in error) {
                const context = (error as any).context;
                if (context instanceof Response) {
                    try {
                        const errorBody = await context.json();
                        console.error("Edge Function Error Body:", JSON.stringify(errorBody));
                        
                        if (errorBody && typeof errorBody === 'object') {
                            errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
                        }
                    } catch (e) {
                         try {
                            const errorText = await context.text();
                            if (errorText) errorMessage = errorText;
                         } catch (te) {}
                    }
                }
            }
            
            throw new Error(`GPT-Image-1 Service Error: ${errorMessage}`);
        }

        if (!data) {
             throw new Error("No data received from GPT-Image-1 service.");
        }

        if (!useGenerationStore.getState().isGenerating) throw new Error('Generation cancelled.');

        let blob: Blob;

        if (data.image || data.b64_json) {
            const b64 = data.image || data.b64_json;
            const dataUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
            blob = await (await fetch(dataUrl)).blob();
        } else if (data.url) {
            const resp = await fetch(data.url);
            if (!resp.ok) throw new Error(`Failed to fetch image from URL: ${resp.statusText}`);
            blob = await resp.blob();
        } else if (data.data && Array.isArray(data.data) && data.data[0]?.b64_json) {
             const b64 = data.data[0].b64_json;
             blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        } else if (data.data && Array.isArray(data.data) && data.data[0]?.url) {
             const resp = await fetch(data.data[0].url);
             if (!resp.ok) throw new Error(`Failed to fetch image from URL: ${resp.statusText}`);
             blob = await resp.blob();
        } else {
            console.error("Unknown response format:", data);
            throw new Error("Received unknown response format from GPT-Image-1 service.");
        }

        return { images: [{ blob, meta: { modelUsed: 'gpt-image-1' } }] };
    },
};

const SORA_FN_URL = "https://xcjqilfhlwbykckzdzry.supabase.co/functions/v1/sora-video";

const soraProvider: ImageProvider = {
    id: 'sora-2-video',
    name: 'Sora 2',
    isConfigured: () => true,
    supports: {
        img2img: false,
        negativePrompt: false,
        guidance: false,
        steps: false,
        seed: false,
    },
    async generate(params: GenParams): Promise<GenerateResult> {
        const { setGenerationStatus } = useGenerationStore.getState();
        
        setGenerationStatus("Rendering video...");
        
        const seconds = params.seconds || "4";
        const size = params.soraSize || "1280x720";

        // 1. Call Supabase Edge Function with public URL workflow
        try {
            const res = await fetch(SORA_FN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: params.prompt,
                    seconds,
                    size
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Video generation failed");
            }

            if (!data.video_url) {
                throw new Error("No video URL returned from API");
            }

            // 2. Download content for app storage (Library compatibility)
            // We fetch the blob here to maintain the app's existing storage architecture
            setGenerationStatus("Downloading video...");
            const videoRes = await fetch(data.video_url);
            
            if (!videoRes.ok) {
                 throw new Error("Failed to download generated video file");
            }
            
            const blob = await videoRes.blob();

            return {
                images: [{
                    blob,
                    meta: {
                        modelUsed: 'sora-2-video',
                        mediaType: 'video',
                        soraParams: { seconds, size }
                    }
                }]
            };

        } catch (error: any) {
            console.error("Sora API Error:", error);
            throw new Error(error.message || "Sora 2 generation failed.");
        }
    },
};

const VEO_FN_URL = "https://xcjqilfhlwbykckzdzry.supabase.co/functions/v1/veo-video";

const veoProvider: ImageProvider = {
    id: 'veo-3.1-generate-preview',
    name: 'Veo 3.1',
    isConfigured: () => true, // Edge function handles API key
    supports: { img2img: true, negativePrompt: true, guidance: false, steps: false, seed: false },
    async generate(params: GenParams): Promise<GenerateResult> {
        const { setGenerationStatus } = useGenerationStore.getState();
        
        setGenerationStatus("Preparing Veo 3.1 request...");

        // Map aspect ratio to Veo-supported values
        let ar: '16:9' | '9:16' = '16:9';
        if (params.aspectRatio === '9:16' || params.aspectRatio === '2:3' || params.aspectRatio === '4:5') {
            ar = '9:16';
        }

        // Prepare image input if provided
        let imageBase64: string | undefined;
        let imageMimeType: string | undefined;
        
        if (params.initImageStoragePath) {
            const { data: imageBlob, error } = await supabase.storage.from('images').download(params.initImageStoragePath);
            if (imageBlob && !error) {
                imageBase64 = await blobToBase64(imageBlob);
                imageMimeType = imageBlob.type || 'image/png';
            } else {
                console.warn("Failed to load init image for Veo:", error);
            }
        }

        setGenerationStatus("Generating video with Veo 3.1 (this may take 2-5 minutes)...");

        try {
            const res = await fetch(VEO_FN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: params.prompt,
                    aspectRatio: ar,
                    durationSeconds: "8", // Default to 8 seconds for best quality
                    resolution: "720p",
                    negativePrompt: params.negativePrompt,
                    imageBase64,
                    imageMimeType,
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Veo video generation failed");
            }

            if (!data.video_url) {
                throw new Error("No video URL returned from Veo API");
            }

            if (!useGenerationStore.getState().isGenerating) {
                throw new Error('Generation cancelled.');
            }

            setGenerationStatus("Downloading generated video...");
            
            // Download the video from the returned URL
            const videoRes = await fetch(data.video_url);
            if (!videoRes.ok) {
                throw new Error("Failed to download generated video file");
            }
            
            const blob = await videoRes.blob();

            return {
                images: [{
                    blob,
                    meta: {
                        modelUsed: 'veo-3.1-generate-preview',
                        mediaType: 'video',
                        veoParams: { 
                            aspectRatio: ar, 
                            duration: data.duration,
                            storagePath: data.storage_path 
                        }
                    }
                }]
            };

        } catch (error: any) {
            console.error("Veo API Error:", error);
            throw new Error(error.message || "Veo 3.1 generation failed.");
        }
    }
}

// --- Provider Registry ---
export const imageProviders: Record<ModelId, ImageProvider> = {
    'gemini-3-pro-image-preview': geminiProImageProvider,
    'openai-latest-image': openaiProvider,
    'veo-3.1-generate-preview': veoProvider,
    'sora-2-video': soraProvider,
};

export const getProvider = (id: ModelId): ImageProvider => {
    return imageProviders[id] || geminiProImageProvider;
};
