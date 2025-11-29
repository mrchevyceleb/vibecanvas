// Supabase Edge Function for OpenAI GPT-Image-1
// Deploy with: supabase functions deploy open-ai-image --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OpenAiImageRequest {
  prompt: string;
  aspectRatio?: string;
  resolution?: string; // "1024", "1K", etc.
  n?: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }

    const body: OpenAiImageRequest = await req.json();
    const { prompt, aspectRatio = "1:1" } = body;

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    // Map aspect ratio to gpt-image-1 supported sizes
    // Supported: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
    let size = "1024x1024";
    if (aspectRatio === "16:9" || aspectRatio === "3:2" || aspectRatio === "4:3" || aspectRatio === "21:9") {
        size = "1536x1024";
    } else if (aspectRatio === "9:16" || aspectRatio === "2:3" || aspectRatio === "3:4" || aspectRatio === "4:5" || aspectRatio === "5:4") {
        size = "1024x1536";
    }

    console.log(`[GPT-Image-1] Generating image. Prompt: "${prompt.substring(0, 50)}...", Size: ${size}`);

    const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-image-1",
            prompt: prompt,
            n: 1,
            size: size,
            // output_format: "png", // Default
            // quality: "auto", // Default
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("[GPT-Image-1] API Error:", errorData);
        throw new Error(errorData.error?.message || `OpenAI API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // gpt-image-1 returns "data": [{ "b64_json": "..." }] usually, or url if specified?
    // Docs say: "This parameter isn't supported for gpt-image-1 which will always return base64-encoded images."
    // So we expect b64_json.

    const image = data.data[0];
    
    return new Response(
      JSON.stringify({
        success: true,
        b64_json: image.b64_json, // Pass raw b64 back to client
        revised_prompt: image.revised_prompt, // If any
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[GPT-Image-1] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Image generation failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

