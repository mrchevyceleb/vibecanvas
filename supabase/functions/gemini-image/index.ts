// Supabase Edge Function for Gemini 3 Pro Image Generation
// Keeps API key secure on server-side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@^0.14.0";

interface GeminiImageRequest {
  prompt: string;
  aspectRatio?: string;
  imageSize?: "1K" | "2K" | "4K";
  initImageBase64?: string;
  initImageMimeType?: string;
  isEdit?: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GeminiImageRequest = await req.json();
    const { prompt, aspectRatio = "1:1", imageSize = "1K", initImageBase64, initImageMimeType, isEdit = false } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Gemini Image] Generating with aspectRatio: ${aspectRatio}, imageSize: ${imageSize}, hasInitImage: ${!!initImageBase64}`);

    const ai = new GoogleGenAI({ apiKey });

    // Build contents array
    const contents: any[] = [];

    // Add init image if provided (for img2img or editing)
    if (initImageBase64) {
      contents.push({
        inlineData: {
          data: initImageBase64,
          mimeType: initImageMimeType || "image/png",
        },
      });
    }

    // Add prompt with aspect ratio hint (workaround for API bug)
    const finalPrompt = `${prompt} ${aspectRatio}`;
    contents.push({ text: finalPrompt });

    console.log(`[Gemini Image] Final prompt: ${finalPrompt.substring(0, 100)}...`);

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: contents,
      config: {
        responseModalities: ["Text", "Image"],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize,
        },
      } as any,
    });

    // Extract generated images
    const images: { b64_json: string; mimeType: string }[] = [];
    
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          images.push({
            b64_json: part.inlineData.data,
            mimeType: part.inlineData.mimeType || "image/png",
          });
        }
      }
    }

    if (images.length === 0) {
      const blockReason = response.candidates?.[0]?.finishReason;
      if (blockReason === "SAFETY" || blockReason === "OTHER") {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Image generation was blocked due to: ${blockReason}. Prompt may have violated safety policies.` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "No image was generated. The model may not have returned an image." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Gemini Image] Successfully generated ${images.length} image(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        images: images,
        model: "gemini-3-pro-image-preview"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Gemini Image] Error:", error);
    
    const errorMessage = error.message || "Unknown error occurred";
    const isKeyError = errorMessage.toLowerCase().includes("api key") || 
                       errorMessage.toLowerCase().includes("403") ||
                       errorMessage.toLowerCase().includes("requested entity was not found");

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: isKeyError 
          ? "API Key not valid. Please check server configuration."
          : errorMessage
      }),
      { status: isKeyError ? 401 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

