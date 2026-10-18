import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { ImageRecord, Folder } from "../types";
import { supabase } from "../supabase/client";
import { toast } from "../components/ui/Toaster";
import { MODEL_DETAILS } from "../constants";
import { mediaSizeLimit } from "../lib/media";
type CleanupTask = { bucket: "images" | "video"; path: string };
const cleanupCache = new Map<string, CleanupTask[]>();
function cleanupTasks(userId: string): CleanupTask[] {
  if (cleanupCache.has(userId)) return cleanupCache.get(userId)!;
  try {
    const stored = JSON.parse(
      localStorage.getItem(`vibecanvas:cleanup:${userId}`) || "[]",
    );
    return Array.isArray(stored)
      ? stored.filter(
          (task) =>
            ["images", "video"].includes(task.bucket) &&
            typeof task.path === "string" &&
            task.path.startsWith(`${userId}/`),
        )
      : [];
  } catch {
    return [];
  }
}
function keepCleanup(userId: string, tasks: CleanupTask[]) {
  cleanupCache.set(userId, tasks);
  try {
    localStorage.setItem(`vibecanvas:cleanup:${userId}`, JSON.stringify(tasks));
  } catch {
    /* Retain in memory. */
  }
}

interface LibraryState {
  imageRecords: ImageRecord[];
  folders: Folder[];
  loading: boolean;
  ownerId: string | null;
  cleanupPending: boolean;
  retryStorageCleanup: (userId: string) => Promise<boolean>;
  fetchLibraryContent: (userId: string) => Promise<void>;
  addImage: (
    recordData: Omit<ImageRecord, "id" | "createdAt" | "storage_path">,
    blob: Blob,
    userId: string,
  ) => Promise<ImageRecord | null>;
  deleteImage: (id: string) => Promise<void>;
  deleteImages: (ids: string[]) => Promise<void>;
  updateImage: (id: string, updates: Partial<ImageRecord>) => Promise<void>;
  getImageRecord: (id: string) => ImageRecord | undefined;
  duplicateImage: (
    id: string,
    userId: string,
  ) => Promise<ImageRecord | undefined>;
  uploadFile: (blob: Blob, userId: string) => Promise<{ path: string } | null>;
  createFolder: (name: string, userId: string) => Promise<void>;
  moveImage: (imageId: string, folderId: string | null) => Promise<void>;
  moveImages: (
    ids: string[],
    folderId: string | null,
  ) => Promise<{ moved: string[]; failed: string[] }>;
  toggleStar: (id: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  imageRecords: [],
  folders: [],
  loading: true,
  ownerId: null,
  cleanupPending: false,
  retryStorageCleanup: async (userId) => {
    for (const bucket of ["images", "video"] as const) {
      const paths = cleanupTasks(userId)
        .filter((task) => task.bucket === bucket)
        .map((task) => task.path);
      if (!paths.length) continue;
      try {
        const { error } = await supabase.storage.from(bucket).remove(paths);
        if (!error)
          keepCleanup(
            userId,
            cleanupTasks(userId).filter(
              (task) => task.bucket !== bucket || !paths.includes(task.path),
            ),
          );
      } catch {
        /* Keep work available for a later retry. */
      }
    }
    const remaining = cleanupTasks(userId).length > 0;
    if (get().ownerId === userId) set({ cleanupPending: remaining });
    return !remaining;
  },
  fetchLibraryContent: async (userId) => {
    set({
      loading: true,
      ownerId: userId,
      cleanupPending: cleanupTasks(userId).length > 0,
    });

    const [imagesRes, foldersRes] = await Promise.all([
      supabase
        .from("image_records")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (get().ownerId !== userId) return;
    if (imagesRes.error) {
      toast("Failed to fetch library images.", "error");
      console.error(imagesRes.error);
    } else {
      // Map DB records to include mediaType and ensure createdAt is present
      // Fallback to meta or 'image' for legacy records if column is null
      const mappedImages = (imagesRes.data || []).map((r: any) => ({
        ...r,
        createdAt: r.created_at, // Map snake_case from DB to camelCase for app
        mediaType: r.mediaType || r.meta?.mediaType || "image",
      }));
      set({ imageRecords: mappedImages });
    }

    if (foldersRes.error) {
      toast("Failed to fetch library folders.", "error");
      console.error(foldersRes.error);
    } else {
      set({ folders: foldersRes.data || [] });
    }

    set({ loading: false });
  },
  uploadFile: async (blob, userId) => {
    const isVideo = blob.type.startsWith("video/");
    if (blob.size > mediaSizeLimit(isVideo ? "video" : "image")) {
      toast(
        `This file exceeds the ${isVideo ? 50 : 20} MB library limit.`,
        "error",
      );
      return null;
    }
    const bucketName = isVideo ? "video" : "images";
    const fileExt = blob.type.split("/")[1] || "bin";
    const filePath = `${userId}/${uuidv4()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: blob.type || undefined,
      });

    if (error) {
      toast(`Failed to upload file: ${error.message}`, "error");
      console.error(error);
      return null;
    }
    return { path: data.path };
  },
  addImage: async (recordData, blob, userId) => {
    const uploadResult = await get().uploadFile(blob, userId);
    if (!uploadResult) return null;

    // Determine media type if not provided, defaulting to image
    let mediaType = recordData.mediaType;
    if (!mediaType) {
      const modelInfo = MODEL_DETAILS[recordData.model];
      mediaType = modelInfo?.type || "image";
    }

    const dbPayload = {
      id: uuidv4(),
      user_id: userId,
      model: recordData.model,
      params: recordData.params,
      promptTextAtGen: recordData.promptTextAtGen,
      created_at: new Date().toISOString(),
      storage_path: uploadResult.path,
      folder_id: recordData.folder_id || null,
      sourceType: recordData.sourceType,
      meta: recordData.meta,
      mediaType: mediaType, // Using the DB column now
    };

    const { data, error } = await supabase
      .from("image_records")
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      toast("Failed to save record.", "error");
      console.error(error);
      // Persist cleanup before attempting it, including failed database saves.
      const bucket = mediaType === "video" ? "video" : "images";
      keepCleanup(userId, [
        ...cleanupTasks(userId),
        { bucket, path: uploadResult.path },
      ]);
      await get().retryStorageCleanup(userId);
      return null;
    }

    // Construct frontend record
    const newRecord: ImageRecord = {
      ...data,
      createdAt: data.created_at, // Map snake_case from DB to camelCase for app
      mediaType: data.mediaType || mediaType || "image",
    };

    if (get().ownerId === userId)
      set((state) => ({
        imageRecords: [
          newRecord,
          ...state.imageRecords.filter((record) => record.id !== newRecord.id),
        ],
      }));
    return newRecord;
  },
  deleteImage: async (id) => {
    await get().deleteImages([id]);
  },
  deleteImages: async (ids) => {
    if (ids.length === 0) return;

    const recordsToDelete = get().imageRecords.filter((r) =>
      ids.includes(r.id),
    );
    if (recordsToDelete.length === 0) return;

    // Group paths by bucket
    const userId = get().ownerId;
    if (!userId) throw new Error("Please sign in to delete creations.");

    // Remove records first: a failed database delete must not leave broken previews.
    const { error: dbError } = await supabase
      .from("image_records")
      .delete()
      .in("id", ids);
    if (dbError)
      throw new Error("Could not delete these creations. Please try again.");
    set((state) => ({
      imageRecords: state.imageRecords.filter((r) => !ids.includes(r.id)),
    }));
    keepCleanup(userId, [
      ...cleanupTasks(userId),
      ...recordsToDelete.map((record) => ({
        bucket:
          record.mediaType === "video"
            ? ("video" as const)
            : ("images" as const),
        path: record.storage_path,
      })),
    ]);
    if (!(await get().retryStorageCleanup(userId)))
      toast(
        "Creations removed from your library, but file cleanup is incomplete. Retry cleanup in the Library.",
        "error",
      );
    else
      toast(
        `${ids.length} item${ids.length > 1 ? "s" : ""} deleted.`,
        "success",
      );
  },
  updateImage: async (id, updates) => {
    const { data, error } = await supabase
      .from("image_records")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      toast("Failed to update record.", "error");
    } else {
      const updatedRecord = {
        ...data,
        createdAt: data.created_at, // Map snake_case from DB to camelCase for app
        mediaType: data.mediaType || data.meta?.mediaType || "image",
      };
      set((state) => ({
        imageRecords: state.imageRecords.map((r) =>
          r.id === id ? updatedRecord : r,
        ),
      }));
    }
  },
  getImageRecord: (id) => {
    return get().imageRecords.find((r) => r.id === id);
  },
  duplicateImage: async (id, userId) => {
    const recordToDuplicate = get().imageRecords.find((r) => r.id === id);
    if (!recordToDuplicate) return undefined;

    const bucket = recordToDuplicate.mediaType === "video" ? "video" : "images";
    const { data: blob, error } = await supabase.storage
      .from(bucket)
      .download(recordToDuplicate.storage_path);

    if (error || !blob) {
      toast("Failed to retrieve original file for duplication.", "error");
      return undefined;
    }

    const newRecordData = {
      model: recordToDuplicate.model,
      params: recordToDuplicate.params,
      promptTextAtGen: recordToDuplicate.promptTextAtGen,
      sourceType: recordToDuplicate.sourceType,
      meta: { ...recordToDuplicate.meta, duplicatedFrom: id },
      folder_id: recordToDuplicate.folder_id,
      mediaType: recordToDuplicate.mediaType,
    };

    return get().addImage(newRecordData, blob, userId);
  },
  createFolder: async (name, userId) => {
    const newFolder = {
      name,
      user_id: userId,
    };
    const { data, error } = await supabase
      .from("folders")
      .insert(newFolder)
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    } else {
      set((state) => ({ folders: [data, ...state.folders] }));
      toast("Folder created.", "success");
    }
  },
  moveImage: async (imageId, folderId) => {
    const result = await get().moveImages([imageId], folderId);
    if (result.failed.length)
      throw new Error("Could not move this item. Please try again.");
    toast("Item moved.", "success");
  },
  moveImages: async (ids, folderId) => {
    const owner = get().ownerId;
    if (!owner) throw new Error("Please sign in to move creations.");
    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        const { data, error } = await supabase
          .from("image_records")
          .update({ folder_id: folderId })
          .eq("id", id)
          .eq("user_id", owner)
          .select()
          .single();
        if (error) throw error;
        return {
          ...data,
          createdAt: data.created_at,
          mediaType: data.mediaType || data.meta?.mediaType || "image",
        } as ImageRecord;
      }),
    );
    const records = outcomes.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (get().ownerId === owner)
      set((state) => ({
        imageRecords: state.imageRecords.map(
          (record) => records.find((value) => value.id === record.id) || record,
        ),
      }));
    return {
      moved: records.map((record) => record.id),
      failed: ids.filter((_, index) => outcomes[index].status === "rejected"),
    };
  },
  toggleStar: async (id) => {
    const record = get().imageRecords.find((r) => r.id === id);
    if (!record) return;

    const currentMeta = record.meta || {};
    const newMeta = { ...currentMeta, isStarred: !currentMeta.isStarred };

    const { error } = await supabase
      .from("image_records")
      .update({ meta: newMeta })
      .eq("id", id);

    if (error) {
      toast("Failed to update star status", "error");
      console.error(error);
    } else {
      set((state) => ({
        imageRecords: state.imageRecords.map((r) =>
          r.id === id ? { ...r, meta: newMeta } : r,
        ),
      }));
      toast(
        newMeta.isStarred ? "Added to Favorites" : "Removed from Favorites",
        "success",
      );
    }
  },
}));
