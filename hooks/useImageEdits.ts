import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useLibraryStore } from "../store/useLibraryStore";
import { getProvider } from "../services/imageProviders";
import {
  getFalModel,
  normalizeParams,
} from "../supabase/functions/_shared/falModels";
import { ImageRecord, ModelId } from "../types";
import { MediaRecoveryError } from "../lib/media";

export function useImageEdits(initial: ImageRecord | undefined) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<ImageRecord[]>(
    initial ? [initial] : [],
  );
  const [current, setCurrent] = useState(initial);
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState<ModelId>(
    "gemini-3.1-flash-image-preview",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [recoveryUrl, setRecoveryUrl] = useState("");
  const controller = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const focusAfterEdit = useRef(false);

  useEffect(() => {
    if (!busy && focusAfterEdit.current) {
      focusAfterEdit.current = false;
      promptRef.current?.focus();
    }
  }, [busy]);

  useEffect(() => {
    setVersions(initial ? [initial] : []);
    setCurrent(initial);
    setPrompt("");
    setError("");
    setStatus("");
    setRecoveryUrl("");
    setBusy(false);
    const model = initial && getFalModel(initial.model);
    setModelId(
      model?.type === "image" && model.editEndpoint
        ? initial!.model
        : "gemini-3.1-flash-image-preview",
    );
    return () => {
      controller.current?.abort();
      controller.current = null;
      focusAfterEdit.current = false;
    };
  }, [initial?.id, user?.id]);

  const acceptVersion = (record: ImageRecord) => {
    setVersions((previous) => [...previous, record]);
    setCurrent(record);
  };
  const selectVersion = (record: ImageRecord) => {
    if (controller.current) return;
    setCurrent(record);
    setError("");
    setStatus("");
    setRecoveryUrl("");
    promptRef.current?.focus();
  };
  const sendEdit = async () => {
    if (
      !current ||
      current.mediaType !== "image" ||
      !user ||
      !prompt.trim() ||
      controller.current
    )
      return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    setRecoveryUrl("");
    setStatus("Starting your edit…");
    try {
      const params = normalizeParams(getFalModel(modelId)!, {
        ...current.params,
        prompt: prompt.trim(),
        initImageStoragePath: current.storage_path,
        initImageBucket: "images",
      });
      const output = await getProvider(modelId).generate(params, {
        signal: request.signal,
        onStatus: (message) => {
          if (!request.signal.aborted) setStatus(message);
        },
      });
      if (request.signal.aborted) return;
      const image = output.images[0];
      if (!image) throw new Error("No edited image returned. Try again.");
      setStatus("Saving your edit…");
      const saved = await useLibraryStore.getState().addImage(
        {
          model: modelId,
          params: output.params || params,
          promptTextAtGen: params.prompt,
          sourceType: "edit",
          meta: { ...image.meta, parentId: current.id },
          folder_id: current.folder_id,
          mediaType: "image",
        },
        image.blob,
        user.id,
      );
      if (!saved)
        throw new MediaRecoveryError(
          "Your edit could not be saved. Retry or download it below.",
          String(image.meta?.outputUrl || ""),
        );
      output.acknowledgeSaved?.();
      // Saving cannot be cancelled. Show a completed save even if Stop was
      // pressed during it, but never update a workspace that has since closed.
      if (controller.current !== request) return;
      acceptVersion(saved);
      setPrompt("");
      setError("");
      setStatus("Edit saved. Ready for your next change.");
    } catch (err) {
      if (request.signal.aborted) return;
      setError(
        err instanceof Error ? err.message : "Editing failed. Try again.",
      );
      if (err instanceof MediaRecoveryError) setRecoveryUrl(err.downloadUrl);
    } finally {
      if (controller.current === request) {
        controller.current = null;
        focusAfterEdit.current = true;
        setBusy(false);
      }
    }
  };
  const stop = () => {
    controller.current?.abort();
    setStatus("Stopping your edit…");
    setError(
      "Cancellation requested. A request already rendering may still be charged.",
    );
  };
  return {
    current: current || initial,
    versions,
    prompt,
    setPrompt,
    promptRef,
    modelId,
    setModelId,
    busy,
    status,
    error,
    recoveryUrl,
    sendEdit,
    stop,
    selectVersion,
    acceptVersion,
  };
}
