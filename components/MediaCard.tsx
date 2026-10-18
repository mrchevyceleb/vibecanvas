import React from "react";
import { ImageRecord } from "../types";
import { useImageLoader } from "../hooks/useImageLoader";
import { MODEL_DETAILS } from "../constants";
import { StarIcon } from "./ui/Icons";
export function MediaCard({
  record,
  onOpen,
  onStar,
}: {
  record: ImageRecord;
  onOpen: () => void;
  onStar?: () => void;
}) {
  const { imageUrl, isLoading, error } = useImageLoader(
    record.storage_path,
    record.mediaType === "video" ? "video" : "images",
  );
  return (
    <article className="media-card">
      <button
        className="media-card-image"
        onClick={onOpen}
        aria-label={`Open ${record.promptTextAtGen || record.mediaType}`}
      >
        {isLoading ? (
          <span className="skeleton" />
        ) : error ? (
          <span className="muted">Preview unavailable</span>
        ) : record.mediaType === "video" ? (
          <>
            <video src={imageUrl || undefined} muted preload="metadata" />
            <span className="play-indicator">▶</span>
          </>
        ) : (
          <img
            src={imageUrl || undefined}
            alt={record.promptTextAtGen}
            loading="lazy"
          />
        )}
      </button>
      <div className="media-card-info">
        <div>
          <p title={record.promptTextAtGen}>
            {record.promptTextAtGen || "Untitled creation"}
          </p>
          <span>
            {record.sourceType === "upload"
              ? "Uploaded"
              : MODEL_DETAILS[record.model]?.name || record.model}
          </span>
        </div>
        {onStar && (
          <button
            className="icon-button"
            aria-label={
              record.meta?.isStarred ? "Remove favorite" : "Add favorite"
            }
            aria-pressed={!!record.meta?.isStarred}
            onClick={onStar}
          >
            <StarIcon filled={!!record.meta?.isStarred} />
          </button>
        )}
      </div>
    </article>
  );
}
