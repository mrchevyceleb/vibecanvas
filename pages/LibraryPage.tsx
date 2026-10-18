import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLibraryStore } from "../store/useLibraryStore";
import { MediaCard } from "../components/MediaCard";
import { Lightbox } from "../components/Lightbox";
import { ImageRecord } from "../types";
import { MODEL_DETAILS } from "../constants";
import { toast } from "../components/ui/Toaster";
import { FolderIcon } from "../components/ui/Icons";
const LibraryPage: React.FC = () => {
  const { user } = useAuth();
  const library = useLibraryStore();
  const [query, setQuery] = useState(""),
    [media, setMedia] = useState<"all" | "image" | "video">("all"),
    [favorites, setFavorites] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null),
    [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [selecting, setSelecting] = useState(false);
  const [open, setOpen] = useState<ImageRecord | null>(null),
    [newFolder, setNewFolder] = useState<string | null>(null),
    [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (user) void library.fetchLibraryContent(user.id);
  }, [user?.id]);
  useEffect(() => {
    setSelected(new Set());
  }, [media, folderId, query, favorites]);
  const filtered = useMemo(
    () =>
      library.imageRecords
        .filter(
          (record) =>
            (!folderId || record.folder_id === folderId) &&
            (media === "all" || record.mediaType === media) &&
            (!favorites || record.meta?.isStarred) &&
            `${record.promptTextAtGen} ${MODEL_DETAILS[record.model]?.name || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          if (sort === "favorites") {
            const diff =
              Number(!!b.meta?.isStarred) - Number(!!a.meta?.isStarred);
            if (diff) return diff;
          }
          const delta =
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return sort === "oldest" ? -delta : delta;
        }),
    [library.imageRecords, query, media, favorites, folderId, sort],
  );
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const run = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    await run("Uploading…", async () => {
      let saved = 0;
      for (const file of Array.from(files)) {
        const video = file.type.startsWith("video/");
        if (
          ![
            "image/png",
            "image/jpeg",
            "image/webp",
            "video/mp4",
            "video/webm",
          ].includes(file.type) ||
          file.size > (video ? 50 : 20) * 1024 * 1024
        ) {
          toast(
            `${file.name}: use PNG, JPEG, WebP (up to 20 MB), or MP4/WebM (up to 50 MB).`,
            "error",
          );
          continue;
        }
        const record = await library.addImage(
          {
            model: video ? "wan-2.6" : "gemini-3.1-flash-image-preview",
            params: {
              prompt: file.name,
              aspectRatio: "1:1",
              resolution: "1024",
            },
            promptTextAtGen: file.name,
            sourceType: "upload",
            folder_id: folderId,
            mediaType: video ? "video" : "image",
          },
          file,
          user.id,
        );
        if (record) saved++;
      }
      if (saved)
        toast(`${saved} file${saved === 1 ? "" : "s"} saved to library.`);
    });
    if (fileInput.current) fileInput.current.value = "";
  };
  const deleteSelected = () => {
    if (
      !selected.size ||
      !window.confirm(
        `Delete ${selected.size} selected creation${selected.size === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return;
    void run("Deleting…", async () => {
      await library.deleteImages([...selected]);
      setSelected(new Set());
      setSelecting(false);
    });
  };
  return (
    <div
      className="page-shell library-page"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          void upload(event.dataTransfer.files);
        }
      }}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">MADE BY YOU</p>
          <h1>Your creative collection.</h1>
          <p className="muted">
            Find your favorites, organize your ideas, and pick up where you left
            off.
          </p>
        </div>
        <div className="heading-actions">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
            className="sr-only"
            tabIndex={-1}
            aria-label="Upload media files"
            onChange={(event) => upload(event.target.files)}
          />
          <button
            className="secondary-button"
            disabled={!!busy}
            onClick={() => setNewFolder("")}
          >
            ＋ New folder
          </button>
          <button
            className="primary-button"
            disabled={!!busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy || "Upload files"}
            <span>↑</span>
          </button>
        </div>
      </div>
      {library.cleanupPending && (
        <div className="panel error-banner" role="alert">
          <p>Some deleted files still need cleanup.</p>
          <button
            className="secondary-button"
            disabled={!!busy}
            onClick={() =>
              user &&
              void run("Cleaning up…", async () => {
                if (!(await library.retryStorageCleanup(user.id)))
                  throw new Error(
                    "File cleanup failed. Please try again later.",
                  );
                toast("File cleanup complete.");
              })
            }
          >
            Retry file cleanup
          </button>
        </div>
      )}
      {newFolder !== null && (
        <form
          className="new-folder-form panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (newFolder.trim() && user)
              void run("Creating folder…", async () => {
                await library.createFolder(newFolder.trim(), user.id);
                setNewFolder(null);
              });
          }}
        >
          <label htmlFor="folder-name" className="field-label">
            Folder name
          </label>
          <input
            id="folder-name"
            value={newFolder}
            onChange={(event) => setNewFolder(event.target.value)}
            maxLength={80}
            autoFocus
            required
            disabled={!!busy}
          />
          <button
            className="primary-button"
            disabled={!newFolder.trim() || !!busy}
          >
            Create folder
          </button>
          <button
            type="button"
            className="quiet-button"
            disabled={!!busy}
            onClick={() => setNewFolder(null)}
          >
            Cancel
          </button>
        </form>
      )}
      <div className="library-toolbar">
        <div className="filter-tabs" role="group" aria-label="Media type">
          {(["all", "image", "video"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={media === value}
              onClick={() => setMedia(value)}
            >
              {value === "all"
                ? "All creations"
                : value === "image"
                  ? "Images"
                  : "Videos"}
            </button>
          ))}
        </div>
        <button
          className="secondary-button"
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          ☆ Favorites
        </button>
        <input
          type="search"
          aria-label="Search creations"
          placeholder="Search prompts or models…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Sort creations"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="favorites">Favorites first</option>
        </select>
      </div>
      <div className="library-breadcrumb">
        <button
          className="text-link"
          onClick={() => setFolderId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const id = event.dataTransfer.getData("imageId");
            if (id) {
              event.stopPropagation();
              void run("Moving…", () => library.moveImage(id, null));
            }
          }}
        >
          All creations
        </button>
        {folderId && (
          <span>
            {" "}
            / {library.folders.find((folder) => folder.id === folderId)?.name}
          </span>
        )}
        <span className="muted">
          {filtered.length} item{filtered.length === 1 ? "" : "s"}
        </span>
        <button
          className="quiet-button"
          onClick={() => {
            setSelecting(!selecting);
            setSelected(new Set());
          }}
        >
          {selecting ? "Done selecting" : "Select items"}
        </button>
      </div>
      {selecting && (
        <div className="selection-toolbar panel">
          <strong>{selected.size} selected</strong>
          <button
            className="quiet-button"
            onClick={() =>
              setSelected(new Set(filtered.map((record) => record.id)))
            }
          >
            Select all visible
          </button>
          <select
            aria-label="Move selected to folder"
            value=""
            disabled={!selected.size || !!busy}
            onChange={(event) => {
              const destination =
                event.target.value === "root" ? null : event.target.value;
              void run("Moving…", async () => {
                const result = await library.moveImages(
                  [...selected],
                  destination,
                );
                setSelected(new Set(result.failed));
                toast(
                  `${result.moved.length} moved${result.failed.length ? `; ${result.failed.length} could not be moved. Failed items remain selected.` : "."}`,
                  result.failed.length ? "error" : "success",
                );
              });
            }}
          >
            <option value="" disabled>
              Move to…
            </option>
            <option value="root">No folder</option>
            {library.folders.map((folder) => (
              <option value={folder.id} key={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <button
            className="danger-button"
            onClick={deleteSelected}
            disabled={!selected.size || !!busy}
          >
            Delete selected
          </button>
        </div>
      )}
      {!folderId && !query && !favorites && library.folders.length > 0 && (
        <div className="folder-grid">
          {library.folders.map((folder) => (
            <button
              key={folder.id}
              className="folder-card panel"
              onClick={() => setFolderId(folder.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData("imageId");
                if (id) {
                  event.stopPropagation();
                  void run("Moving…", () => library.moveImage(id, folder.id));
                }
              }}
            >
              <FolderIcon />
              <span>
                {folder.name}
                <small>
                  {
                    library.imageRecords.filter(
                      (record) => record.folder_id === folder.id,
                    ).length
                  }{" "}
                  creations
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
        </div>
      )}
      {library.loading && !library.imageRecords.length ? (
        <div className="library-grid" aria-label="Loading library">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="skeleton recent-skeleton" key={index} />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="library-grid">
          {filtered.map((record) => (
            <div
              key={record.id}
              className={`library-card-wrap ${selected.has(record.id) ? "selected" : ""}`}
              draggable={!selecting}
              onDragStart={(event) =>
                event.dataTransfer.setData("imageId", record.id)
              }
            >
              {selecting && (
                <label className="selection-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.has(record.id)}
                    onChange={() => toggle(record.id)}
                    aria-label={`Select ${record.promptTextAtGen}`}
                  />
                </label>
              )}
              <MediaCard
                record={record}
                onOpen={() => (selecting ? toggle(record.id) : setOpen(record))}
                onStar={
                  selecting ? undefined : () => library.toggleStar(record.id)
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="library-empty panel">
          <FolderIcon />
          <h2>
            {query || favorites
              ? "No creations match yet."
              : "Make something worth keeping."}
          </h2>
          <p className="muted">
            {query || favorites
              ? "Try another search or clear your filters."
              : "Generate your first image or video, or drop files here to add them."}
          </p>
          {query || favorites ? (
            <button
              className="secondary-button"
              onClick={() => {
                setQuery("");
                setFavorites(false);
                setMedia("all");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link
              className="primary-button"
              to={media === "video" ? "/video" : "/"}
            >
              Create something ↗
            </Link>
          )}
        </div>
      )}
      {open && <Lightbox imageRecord={open} onClose={() => setOpen(null)} />}
    </div>
  );
};
export default LibraryPage;
