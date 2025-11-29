// Supabase Edge Function for Veo 3.1 Video Generation
// Deploy with: supabase functions deploy veo-video --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@^0.14.0";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VeoRequest {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: "4" | "6" | "8";
  resolution?: "720p" | "1080p";
  negativePrompt?: string;
  // Base64 encoded image for image-to-video
  imageBase64?: string;
  imageMimeType?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ai = new GoogleGenAI({ apiKey });

    const body: VeoRequest = await req.json();
    const { 
      prompt, 
      aspectRatio = "16:9", 
      durationSeconds = "8",
      resolution = "720p",
      negativePrompt,
      imageBase64,
      imageMimeType
    } = body;

    if (!prompt || prompt.trim().length === 0) {
      throw new Error("Prompt is required");
    }

    console.log(`[Veo] Starting video generation: "${prompt.substring(0, 50)}..."`);

    // Build the request config
    const config: Record<string, any> = {
      aspectRatio,
      numberOfVideos: 1,
    };

    // Only add resolution if supported (720p is default, 1080p only for 8s)
    if (resolution === "1080p" && durationSeconds === "8") {
      config.resolution = "1080p";
    }

    if (negativePrompt) {
      config.negativePrompt = negativePrompt;
    }

    // Build the generation request
    const generateParams: Record<string, any> = {
      model: "veo-3.1-generate-preview",
      prompt: prompt,
      config,
    };

    // Add image input for image-to-video
    if (imageBase64 && imageMimeType) {
      generateParams.image = {
        imageBytes: imageBase64,
        mimeType: imageMimeType,
      };
    }

    // Start video generation
    let operation = await ai.models.generateVideos(generateParams);

    console.log(`[Veo] Operation started, polling for completion...`);

    // Poll for completion (max 10 minutes)
    const maxPolls = 60; // 60 * 10s = 10 minutes
    let pollCount = 0;

    while (!operation.done && pollCount < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second intervals
      operation = await ai.operations.getVideosOperation({ operation });
      pollCount++;
      console.log(`[Veo] Poll ${pollCount}: done=${operation.done}`);
    }

    if (!operation.done) {
      throw new Error("Video generation timed out after 10 minutes");
    }

    // Check for errors in the operation
    if (operation.error) {
      const errMsg = operation.error.message || (operation.error as any).code || "Unknown Veo Error";
      throw new Error(`Veo generation failed: ${errMsg}`);
    }

    // Get the generated video
    const generatedVideo = operation.response?.generatedVideos?.[0];
    if (!generatedVideo?.video) {
      // Check for safety filter blocks
      const responseAny = operation.response as any;
      if (responseAny?.raiMediaFilteredReasons?.length > 0) {
        throw new Error(`Generation blocked by safety filter: ${responseAny.raiMediaFilteredReasons[0]}`);
      }
      throw new Error("No video was generated. The request may have been blocked by safety filters.");
    }

    console.log(`[Veo] Video generated successfully, downloading...`);

    // Download the video using the file reference
    // The generatedVideo.video contains the file reference
    const videoFile = generatedVideo.video;
    
    // Get the video URI from the file object
    let videoUri: string | undefined;
    if (typeof videoFile === 'object' && videoFile !== null) {
      videoUri = (videoFile as any).uri;
    }

    if (!videoUri) {
      console.error("[Veo] Video file object:", JSON.stringify(videoFile, null, 2));
      throw new Error("Could not extract video URI from response");
    }

    // Download the video bytes
    const separator = videoUri.includes("?") ? "&" : "?";
    const videoResponse = await fetch(`${videoUri}${separator}key=${apiKey}`);
    
    if (!videoResponse.ok) {
      const errText = await videoResponse.text().catch(() => videoResponse.statusText);
      throw new Error(`Failed to download video: ${videoResponse.status} - ${errText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoArrayBuffer = await videoBlob.arrayBuffer();
    const videoBytes = new Uint8Array(videoArrayBuffer);

    console.log(`[Veo] Video downloaded, size: ${videoBytes.length} bytes`);

    // Upload to Supabase storage
    const fileName = `veo-${Date.now()}-${crypto.randomUUID()}.mp4`;
    const storagePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from("video")
      .upload(storagePath, videoBytes, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Veo] Upload error:", uploadError);
      throw new Error(`Failed to upload video to storage: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("video")
      .getPublicUrl(storagePath);

    console.log(`[Veo] Video uploaded successfully: ${storagePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        storage_path: storagePath,
        video_url: publicUrlData.publicUrl,
        duration: durationSeconds,
        aspectRatio,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[Veo] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Video generation failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

