// Supabase Edge Function for Background Removal
// Uses remove.bg API to remove backgrounds from images

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface RemoveBackgroundRequest {
  imageBase64: string;
  mimeType?: string;
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
    const apiKey = Deno.env.get("REMOVE_BG_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "REMOVE_BG_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RemoveBackgroundRequest = await req.json();
    const { imageBase64, mimeType = "image/png" } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Remove Background] Processing image, mimeType: ${mimeType}`);

    // Convert base64 to binary
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create form data for remove.bg API
    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimeType });
    formData.append("image_file", blob, "image.png");
    formData.append("size", "auto");
    formData.append("format", "png");

    // Call remove.bg API
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Remove Background] API error: ${response.status} - ${errorText}`);

      // Handle specific error cases
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "API credits exhausted. Please add more credits to remove.bg account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 400) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid image format or could not process the image." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Background removal failed: ${response.statusText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the result image as array buffer and convert to base64
    const resultBuffer = await response.arrayBuffer();
    const resultBytes = new Uint8Array(resultBuffer);

    // Convert to base64
    let binary = "";
    for (let i = 0; i < resultBytes.length; i++) {
      binary += String.fromCharCode(resultBytes[i]);
    }
    const resultBase64 = btoa(binary);

    console.log(`[Remove Background] Successfully removed background`);

    return new Response(
      JSON.stringify({
        success: true,
        imageBase64: resultBase64,
        mimeType: "image/png",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Remove Background] Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred during background removal",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
