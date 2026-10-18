import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageRecord } from "../types";
import { useImageLoader } from "../hooks/useImageLoader";
import { useLibraryStore } from "../store/useLibraryStore";
import { useAuth } from "../hooks/useAuth";
import { toast } from "./ui/Toaster";
import { MODEL_DETAILS } from "../constants";
import { generateFal } from "../services/imageProviders";
import { CloseIcon, StarIcon } from "./ui/Icons";
import { copyMediaLink, downloadMedia, MediaRecoveryError } from "../lib/media";
import { useImageEdits } from "../hooks/useImageEdits";
import { ImageEditComposer } from "./ImageEditComposer";

export const Lightbox: React.FC<{
  imageRecord: ImageRecord;
  onClose: () => void;
}> = ({ imageRecord, onClose }) => {
  const navigate = useNavigate(),
    { user } = useAuth();
  const { imageRecords, deleteImage, duplicateImage, toggleStar, addImage } =
    useLibraryStore();
  const edits = useImageEdits(imageRecord);
  const currentRecord = edits.current!;
  const record =
    imageRecords.find((value) => value.id === currentRecord.id) ||
    currentRecord;
  const isVideo = record.mediaType === "video";
  const { imageUrl, isLoading, error } = useImageLoader(
    record.storage_path,
    isVideo ? "video" : "images",
  );
  const dialog = useRef<HTMLDialogElement>(null),
    controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<string | null>(null),
    [status, setStatus] = useState("");
  const [recoveryUrl, setRecoveryUrl] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const blocksClose =
    edits.busy ||
    busy === "background" ||
    busy === "duplicate" ||
    busy === "delete";
  const working = !!busy || edits.busy;
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    if (element && !element.open) element.showModal();
    return () => {
      controller.current?.abort();
      element?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  const action = async (name: string, fn: () => Promise<void>) => {
    if (working) return;
    setBusy(name);
    setRecoveryUrl("");
    try {
      await fn();
    } catch (err) {
      if (err instanceof MediaRecoveryError) setRecoveryUrl(err.downloadUrl);
      toast(
        err instanceof Error ? err.message : "Action failed. Please try again.",
        "error",
      );
    } finally {
      setBusy(null);
    }
  };
  const removeBackground = async () => {
    if (!user) return;
    controller.current = new AbortController();
    const result = await generateFal(
      record.model,
      {
        ...record.params,
        prompt: "Remove background",
        initImageStoragePath: record.storage_path,
        initImageBucket: "images",
      },
      { signal: controller.current.signal, onStatus: setStatus },
      "remove-background",
    );
    const saved = await addImage(
      {
        model: record.model,
        params: record.params,
        promptTextAtGen: `${record.promptTextAtGen} (background removed)`,
        sourceType: "edit",
        meta: {
          ...result.images[0].meta,
          parentId: record.id,
          operation: "background-removal",
        },
        folder_id: record.folder_id,
        mediaType: "image",
      },
      result.images[0].blob,
      user.id,
    );
    if (!saved)
      throw new MediaRecoveryError(
        "Could not save the image. Download the original below.",
        String(result.images[0].meta?.outputUrl || ""),
      );
    result.acknowledgeSaved?.();
    toast("Background removed. Saved as a new image.");
    edits.acceptVersion(saved);
  };
  return (
    <dialog
      ref={dialog}
      className="media-dialog"
      aria-labelledby="media-details-title"
      onCancel={(event) => {
        if (blocksClose) event.preventDefault();
        else onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !blocksClose) onClose();
      }}
    >
      <div className="lightbox-toolbar">
        <h2 id="media-details-title">
          {isVideo ? "Video preview" : "Image preview"}
        </h2>
        <button
          className="primary-button"
          disabled={working || !!error || !imageUrl}
          onClick={() => action("download", () => downloadMedia(record))}
        >
          {busy === "download" ? "Downloading…" : "Download"}
        </button>
        <button
          className="secondary-button"
          aria-expanded={showDetails}
          aria-controls="lightbox-details"
          disabled={working}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide details" : "Details & tools"}
        </button>
        <button
          className="icon-button"
          aria-label="Close preview"
          onClick={onClose}
          disabled={blocksClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className={`lightbox-layout ${showDetails ? "details-open" : ""}`}>
        <div className={`lightbox-workspace ${isVideo ? "" : "with-editor"}`}>
          <div className="lightbox-media">
            {isLoading ? (
              <div className="spinner" />
            ) : error ? (
              <div role="alert">
                <h2>Preview unavailable</h2>
                <p>{error}</p>
              </div>
            ) : isVideo ? (
              <video src={imageUrl || undefined} controls preload="metadata" />
            ) : (
              <img src={imageUrl || undefined} alt={record.promptTextAtGen} />
            )}
          </div>
          {!isVideo && <ImageEditComposer edits={edits} disabled={!!busy} />}
        </div>
        <section
          id="lightbox-details"
          className="lightbox-details"
          hidden={!showDetails}
        >
          <div className="section-top">
            <h2>Creation details</h2>
          </div>
          <span className="model-tag">
            {record.sourceType === "upload"
              ? "Uploaded"
              : MODEL_DETAILS[record.model]?.name || record.model}
          </span>
          <p className="detail-prompt">
            {record.promptTextAtGen || "Untitled creation"}
          </p>
          <button
            className="text-link"
            onClick={() =>
              action("copy", async () => {
                await navigator.clipboard.writeText(
                  record.params?.prompt || record.promptTextAtGen,
                );
                toast("Prompt copied.");
              })
            }
            disabled={working}
          >
            Copy prompt
          </button>
          <dl className="detail-list">
            <div>
              <dt>Aspect ratio</dt>
              <dd>{record.params?.aspectRatio || "—"}</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>{record.params?.resolution || "—"}</dd>
            </div>
            {record.params?.duration && (
              <div>
                <dt>Duration</dt>
                <dd>{record.params.duration}s</dd>
              </div>
            )}
            <div>
              <dt>Created</dt>
              <dd>
                {new Date(record.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
            {record.meta?.seed !== undefined && (
              <div>
                <dt>Seed</dt>
                <dd>{record.meta.seed}</dd>
              </div>
            )}
          </dl>
          <div className="lightbox-actions">
            <button
              className="secondary-button"
              disabled={working}
              onClick={() => {
                onClose();
                navigate(isVideo ? "/video" : "/", {
                  state: { remixRecord: record },
                });
              }}
            >
              Remix
            </button>
            <button
              className="secondary-button"
              disabled={working}
              onClick={() => action("favorite", () => toggleStar(record.id))}
              aria-pressed={!!record.meta?.isStarred}
            >
              <StarIcon filled={!!record.meta?.isStarred} />
              {record.meta?.isStarred ? "Favorited" : "Favorite"}
            </button>
            {!isVideo && (
              <>
                <button
                  className="secondary-button"
                  disabled={working || !!error}
                  onClick={() => action("background", removeBackground)}
                >
                  Remove background
                </button>
              </>
            )}
            <button
              className="secondary-button"
              disabled={working || !!error}
              onClick={() =>
                action("duplicate", async () => {
                  if (!user) return;
                  const saved = await duplicateImage(record.id, user.id);
                  if (!saved)
                    throw new Error("Could not duplicate this creation.");
                  toast("Copy saved to library.");
                })
              }
            >
              Duplicate
            </button>
            <button
              className="secondary-button"
              disabled={working || !!error}
              onClick={() => action("link", () => copyMediaLink(record))}
            >
              Copy link (1 hour)
            </button>
          </div>
          {busy && (
            <p className="field-hint" role="status">
              {busy === "background"
                ? status || "Removing background…"
                : "Working…"}
            </p>
          )}
          {recoveryUrl && (
            <p role="alert">
              <a
                className="text-link"
                href={recoveryUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download generated original ↗
              </a>
            </p>
          )}
          {busy === "background" && (
            <button
              className="secondary-button"
              onClick={() => controller.current?.abort()}
            >
              Stop background removal
            </button>
          )}
          <div className="divider" />
          <button
            className="danger-button"
            disabled={working}
            onClick={() => {
              if (
                window.confirm(
                  "Delete this creation from your library? This cannot be undone.",
                )
              )
                void action("delete", async () => {
                  await deleteImage(record.id);
                  onClose();
                });
            }}
          >
            Delete creation
          </button>
        </section>
      </div>
    </dialog>
  );
};
