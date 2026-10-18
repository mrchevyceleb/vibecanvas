import React, { useId, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLibraryStore } from "../store/useLibraryStore";
import { toast } from "./ui/Toaster";
export const UploadZone: React.FC<{
  onUploadComplete: (path: string) => void;
  onUploadingChange?: (busy: boolean) => void;
  currentImageStoragePath?: string;
  disabled?: boolean;
}> = ({ onUploadComplete, onUploadingChange, disabled }) => {
  const { user } = useAuth(),
    { addImage } = useLibraryStore();
  const [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false);
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file || !user || busy || disabled) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    ) {
      toast("Use a PNG, JPEG, or WebP image up to 20 MB.", "error");
      return;
    }
    setBusy(true);
    onUploadingChange?.(true);
    try {
      const result = await addImage(
        {
          model: "gemini-3.1-flash-image-preview",
          params: { prompt: file.name, aspectRatio: "1:1", resolution: "1K" },
          promptTextAtGen: file.name,
          sourceType: "upload",
          folder_id: null,
          mediaType: "image",
        },
        file,
        user.id,
      );
      if (result) onUploadComplete(result.storage_path);
    } catch {
      toast("Upload failed. Please try again.", "error");
    } finally {
      setBusy(false);
      onUploadingChange?.(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div
      className={`upload-zone ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files[0]);
      }}
    >
      <input
        id={id}
        ref={input}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => upload(event.target.files?.[0])}
        disabled={busy || disabled}
      />
      <label htmlFor={id}>
        <span aria-hidden="true">↑</span>
        <strong>
          {busy
            ? "Uploading your reference…"
            : "Drop an image, or browse files"}
        </strong>
        <small>PNG, JPEG, WebP · up to 20 MB · saved to your library</small>
      </label>
      {busy && (
        <span className="sr-only" role="status">
          Uploading reference
        </span>
      )}
    </div>
  );
};
