import { supabase } from "../supabase/client";
import { ImageRecord } from "../types";
import { downloadImage } from "./utils";
import { toast } from "../components/ui/Toaster";
export const mediaSizeLimit = (type: "image" | "video") =>
  (type === "video" ? 50 : 20) * 1024 * 1024;
export class MediaRecoveryError extends Error {
  constructor(
    message: string,
    public downloadUrl: string,
  ) {
    super(message);
  }
}
export async function downloadGeneratedFile(
  file: { url: string; contentType: string },
  signal?: AbortSignal,
) {
  const type = file.contentType.startsWith("video/") ? "video" : "image";
  const limit = mediaSizeLimit(type);
  const tooLarge = () =>
    new MediaRecoveryError(
      `Your generated ${type} exceeds the ${type === "video" ? 50 : 20} MB library limit. Download the original file below.`,
      file.url,
    );
  try {
    const response = await fetch(file.url, { signal });
    if (!response.ok || !response.body)
      throw new Error(
        "The generated file could not be downloaded. Open the original below or retry saving.",
      );
    if (Number(response.headers.get("Content-Length")) > limit) {
      await response.body.cancel();
      throw tooLarge();
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw tooLarge();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return new Blob(chunks, { type: file.contentType });
  } catch (err) {
    if (signal?.aborted || err instanceof MediaRecoveryError) throw err;
    throw new MediaRecoveryError(
      err instanceof Error
        ? err.message
        : "Could not save this file. Open the original below.",
      file.url,
    );
  }
}
export async function copyMediaLink(record: ImageRecord) {
  const { data, error } = await supabase.storage
    .from(record.mediaType === "video" ? "video" : "images")
    .createSignedUrl(record.storage_path, 3600);
  if (error || !data?.signedUrl)
    throw new Error("Could not create a sharing link.");
  await navigator.clipboard.writeText(data.signedUrl);
  toast("Link copied. It expires in 1 hour.");
}
export async function downloadMedia(record: ImageRecord) {
  const { data, error } = await supabase.storage
    .from(record.mediaType === "video" ? "video" : "images")
    .download(record.storage_path);
  if (error || !data) throw new Error("Could not download this creation.");
  const ext =
    data.type.split("/")[1]?.split(";")[0] ||
    (record.mediaType === "video" ? "mp4" : "png");
  downloadImage(data, `vibecanvas-${record.id}.${ext}`);
}
