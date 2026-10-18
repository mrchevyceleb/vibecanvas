import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLibraryStore } from "../store/useLibraryStore";
import { useImageLoader } from "../hooks/useImageLoader";
import {
  FAL_MODELS,
  getFalModel,
  normalizeParams,
} from "../supabase/functions/_shared/falModels";
import { getProvider } from "../services/imageProviders";
import { ImageRecord, ModelId } from "../types";
import { Lightbox } from "../components/Lightbox";
import { toast } from "../components/ui/Toaster";
import { MediaRecoveryError } from "../lib/media";
const EditorPage: React.FC = () => {
  const { id } = useParams(),
    { user } = useAuth();
  const { imageRecords, fetchLibraryContent, loading, addImage } =
    useLibraryStore();
  const record = imageRecords.find((value) => value.id === id);
  const { imageUrl, error, isLoading } = useImageLoader(record?.storage_path);
  const [prompt, setPrompt] = useState(""),
    [modelId, setModelId] = useState<ModelId>("gemini-3.1-flash-image-preview");
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [editError, setEditError] = useState("");
  const [result, setResult] = useState<ImageRecord | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (user) void fetchLibraryContent(user.id);
    return () => controller.current?.abort();
  }, [user?.id]);
  const generate = async () => {
    if (!record || !user || !prompt.trim() || busy) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setEditError("");
    setRecoveryUrl("");
    try {
      const params = normalizeParams(getFalModel(modelId)!, {
        ...record.params,
        prompt,
        initImageStoragePath: record.storage_path,
        initImageBucket: "images",
      });
      const output = await getProvider(modelId).generate(params, {
        signal: current.signal,
        onStatus: setStatus,
      });
      if (current.signal.aborted) return;
      const saved = await addImage(
        {
          model: modelId,
          params: output.params || params,
          promptTextAtGen: prompt,
          sourceType: "edit",
          meta: { ...output.images[0].meta, parentId: record.id },
          folder_id: record.folder_id,
          mediaType: "image",
        },
        output.images[0].blob,
        user.id,
      );
      if (!saved)
        throw new MediaRecoveryError(
          "The edited image could not be saved. Download the original below.",
          String(output.images[0].meta?.outputUrl || ""),
        );
      output.acknowledgeSaved?.();
      if (!current.signal.aborted) {
        setResult(saved);
        toast("Edit saved as a new image.");
      }
    } catch (err) {
      if (!current.signal.aborted && err instanceof MediaRecoveryError)
        setRecoveryUrl(err.downloadUrl);
      if (!current.signal.aborted)
        setEditError(
          err instanceof Error ? err.message : "Editing failed. Try again.",
        );
    } finally {
      if (controller.current === current) setBusy(false);
    }
  };
  if (loading || isLoading)
    return (
      <div className="page-shell loading-page" role="status">
        Loading your image…
      </div>
    );
  if (!record || record.mediaType === "video" || error)
    return (
      <div className="page-shell">
        <h1>Image unavailable</h1>
        <p className="muted">
          {error || "Open an image from your library to start editing."}
        </p>
        <Link to="/library" className="text-link">
          Back to library
        </Link>
      </div>
    );
  return (
    <div className="page-shell">
      <Link to="/library" className="text-link">
        ← Back to library
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>A fresh take on your image.</h1>
          <p className="muted">
            Describe what to change. Every edit is saved as a new image.
          </p>
        </div>
      </div>
      <div className="editor-grid">
        <div className="editor-original panel">
          <img src={imageUrl || undefined} alt={record.promptTextAtGen} />
          <span className="model-tag">Original image</span>
        </div>
        <section className="panel composer">
          <h2>Your edit</h2>
          <label className="field-label" htmlFor="edit-model">
            Editing model
          </label>
          <select
            id="edit-model"
            value={modelId}
            disabled={busy}
            onChange={(event) => setModelId(event.target.value as ModelId)}
          >
            {Object.entries(FAL_MODELS)
              .filter(
                ([id, model]) =>
                  model.type === "image" && getFalModel(id)?.editEndpoint,
              )
              .map(([id, model]) => (
                <option key={id} value={id}>
                  {model.name}
                </option>
              ))}
          </select>
          <label className="field-label" htmlFor="edit-prompt">
            What would you like to change?
          </label>
          <textarea
            id="edit-prompt"
            rows={5}
            maxLength={10000}
            value={prompt}
            disabled={busy}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Change the background to a sunlit garden. Keep the subject and lighting the same."
          />
          {editError && (
            <p className="inline-warning" role="alert">
              {editError}
            </p>
          )}
          {recoveryUrl && (
            <p>
              <a
                className="text-link"
                href={recoveryUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download edited original ↗
              </a>
            </p>
          )}
          {busy && (
            <p className="field-hint" role="status">
              {status}
            </p>
          )}
          <button
            className="primary-button"
            onClick={generate}
            disabled={busy || !prompt.trim()}
          >
            {busy ? "Editing…" : "Generate edit"}
            <span>↗</span>
          </button>
          {busy && (
            <button
              className="quiet-button"
              onClick={() => {
                controller.current?.abort();
                setBusy(false);
                setEditError(
                  "Cancellation requested. A request already rendering may still be charged.",
                );
              }}
            >
              Stop editing
            </button>
          )}
        </section>
      </div>
      {result && (
        <Lightbox imageRecord={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
};
export default EditorPage;
