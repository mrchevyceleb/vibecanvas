import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLibraryStore } from "../store/useLibraryStore";
import { useImageLoader } from "../hooks/useImageLoader";
import { useImageEdits } from "../hooks/useImageEdits";
import { ImageEditComposer } from "../components/ImageEditComposer";

const EditorPage: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { imageRecords, fetchLibraryContent, loading } = useLibraryStore();
  const initial = imageRecords.find((value) => value.id === id);
  const edits = useImageEdits(initial);
  const record = edits.current;
  const { imageUrl, error, isLoading } = useImageLoader(record?.storage_path);
  useEffect(() => {
    if (user) void fetchLibraryContent(user.id);
  }, [user?.id]);
  if (loading && !record)
    return (
      <div className="page-shell loading-page" role="status">
        Loading your image…
      </div>
    );
  if (!record || record.mediaType === "video")
    return (
      <div className="page-shell">
        <h1>Image unavailable</h1>
        <p className="muted">
          Open an image from your library to start editing.
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
          <h1>Keep making it yours.</h1>
          <p className="muted">
            Send a change, see the result, then send another. Every version is
            saved.
          </p>
        </div>
      </div>
      <div className="editor-grid">
        <div className="editor-original panel">
          {isLoading ? (
            <div className="spinner" role="status" aria-label="Loading image" />
          ) : error ? (
            <p role="alert">{error}</p>
          ) : (
            <img src={imageUrl || undefined} alt={record.promptTextAtGen} />
          )}
          <span className="model-tag">
            {edits.versions.length > 1 ? "Selected version" : "Starting image"}
          </span>
        </div>
        <section className="panel">
          <ImageEditComposer edits={edits} />
        </section>
      </div>
    </div>
  );
};
export default EditorPage;
