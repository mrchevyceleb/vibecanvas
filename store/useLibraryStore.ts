
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { ImageRecord, Folder } from '../types';
import { supabase } from '../supabase/client';
import { toast } from '../components/ui/Toaster';
import { MODEL_DETAILS } from '../constants';

interface LibraryState {
  imageRecords: ImageRecord[];
  folders: Folder[];
  loading: boolean;
  fetchLibraryContent: (userId: string) => Promise<void>;
  addImage: (recordData: Omit<ImageRecord, 'id' | 'createdAt' | 'storage_path'>, blob: Blob, userId: string) => Promise<ImageRecord | null>;
  deleteImage: (id: string) => Promise<void>;
  deleteImages: (ids: string[]) => Promise<void>;
  updateImage: (id: string, updates: Partial<ImageRecord>) => Promise<void>;
  getImageRecord: (id: string) => ImageRecord | undefined;
  duplicateImage: (id: string, userId: string) => Promise<ImageRecord | undefined>;
  uploadFile: (blob: Blob, userId: string) => Promise<{path: string} | null>;
  createFolder: (name: string, userId: string) => Promise<void>;
  moveImage: (imageId: string, folderId: string | null) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  imageRecords: [],
  folders: [],
  loading: true,
  fetchLibraryContent: async (userId) => {
    set({ loading: true });
    
    const [imagesRes, foldersRes] = await Promise.all([
      supabase
        .from('image_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ]);

    if (imagesRes.error) {
        toast('Failed to fetch library images.', 'error');
        console.error(imagesRes.error);
    } else {
        // Map DB records to include mediaType and ensure createdAt is present
        // Fallback to meta or 'image' for legacy records if column is null
        const mappedImages = (imagesRes.data || []).map((r: any) => ({
            ...r,
            createdAt: r.created_at, // Map snake_case from DB to camelCase for app
            mediaType: r.mediaType || r.meta?.mediaType || 'image'
        }));
        set({ imageRecords: mappedImages });
    }
    
    if (foldersRes.error) {
        toast('Failed to fetch library folders.', 'error');
        console.error(foldersRes.error);
    } else {
        set({ folders: foldersRes.data || [] });
    }

    set({ loading: false });
  },
  uploadFile: async (blob, userId) => {
    const isVideo = blob.type.startsWith('video/');
    const bucketName = isVideo ? 'video' : 'images';
    const fileExt = blob.type.split('/')[1] || 'bin';
    const filePath = `${userId}/${uuidv4()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
          contentType: blob.type || undefined
      });

    if (error) {
      toast(`Failed to upload file: ${error.message}`, 'error');
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
        mediaType = modelInfo?.type || 'image';
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
    
    const { data, error } = await supabase.from('image_records').insert(dbPayload).select().single();

    if (error) {
      toast('Failed to save record.', 'error');
      console.error(error);
      // Clean up orphaned storage object
      const bucket = mediaType === 'video' ? 'video' : 'images';
      await supabase.storage.from(bucket).remove([uploadResult.path]);
      return null;
    }
    
    // Construct frontend record
    const newRecord: ImageRecord = {
        ...data,
        createdAt: data.created_at, // Map snake_case from DB to camelCase for app
        mediaType: data.mediaType || mediaType || 'image'
    };
    
    set((state) => ({
      imageRecords: [newRecord, ...state.imageRecords],
    }));
    return newRecord;
  },
  deleteImage: async (id) => {
    get().deleteImages([id]);
  },
  deleteImages: async (ids) => {
    if (ids.length === 0) return;

    const recordsToDelete = get().imageRecords.filter(r => ids.includes(r.id));
    if (recordsToDelete.length === 0) return;

    // Group paths by bucket
    const imagePaths = recordsToDelete.filter(r => r.mediaType !== 'video').map(r => r.storage_path);
    const videoPaths = recordsToDelete.filter(r => r.mediaType === 'video').map(r => r.storage_path);

    // Delete from storage
    if (imagePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('images').remove(imagePaths);
        if (storageError) console.error('Failed to delete images from storage:', storageError);
    }
    if (videoPaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('video').remove(videoPaths);
        if (storageError) console.error('Failed to delete videos from storage:', storageError);
    }
    
    // Then, delete the records from the database
    const { error: dbError } = await supabase.from('image_records').delete().in('id', ids);
    if (dbError) {
        toast('Failed to delete records.', 'error');
        return;
    }

    set((state) => ({
      imageRecords: state.imageRecords.filter((r) => !ids.includes(r.id)),
    }));
    toast(`${ids.length} item${ids.length > 1 ? 's' : ''} deleted.`, 'success');
  },
  updateImage: async (id, updates) => {
    const { data, error } = await supabase.from('image_records').update(updates).eq('id', id).select().single();
     if (error) {
        toast('Failed to update record.', 'error');
     } else {
        const updatedRecord = {
            ...data,
            createdAt: data.created_at, // Map snake_case from DB to camelCase for app
            mediaType: data.mediaType || data.meta?.mediaType || 'image'
        };
        set((state) => ({
          imageRecords: state.imageRecords.map((r) => (r.id === id ? updatedRecord : r)),
        }));
     }
  },
  getImageRecord: (id) => {
    return get().imageRecords.find((r) => r.id === id);
  },
  duplicateImage: async (id, userId) => {
    const recordToDuplicate = get().imageRecords.find((r) => r.id === id);
    if (!recordToDuplicate) return undefined;

    const bucket = recordToDuplicate.mediaType === 'video' ? 'video' : 'images';
    const { data: blob, error } = await supabase.storage.from(bucket).download(recordToDuplicate.storage_path);
    
    if (error || !blob) {
        toast('Failed to retrieve original file for duplication.', 'error');
        return undefined;
    }

    const newRecordData = {
        model: recordToDuplicate.model,
        params: recordToDuplicate.params,
        promptTextAtGen: recordToDuplicate.promptTextAtGen,
        sourceType: recordToDuplicate.sourceType,
        meta: { ...recordToDuplicate.meta, duplicatedFrom: id },
        folder_id: recordToDuplicate.folder_id,
        mediaType: recordToDuplicate.mediaType
    };
    
    return get().addImage(newRecordData, blob, userId);
  },
  createFolder: async (name, userId) => {
    const newFolder = {
      name,
      user_id: userId,
    };
    const { data, error } = await supabase.from('folders').insert(newFolder).select().single();
    if (error) {
      toast(`Failed to create folder: ${error.message}`, 'error');
      console.error(error);
    } else {
      set(state => ({ folders: [data, ...state.folders] }));
      toast('Folder created.', 'success');
    }
  },
  moveImage: async (imageId, folderId) => {
    const { data, error } = await supabase
      .from('image_records')
      .update({ folder_id: folderId })
      .eq('id', imageId)
      .select()
      .single();

    if (error) {
      toast(`Failed to move item: ${error.message}`, 'error');
      console.error(error);
    } else {
      const updatedRecord = {
          ...data,
          createdAt: data.created_at, // Map snake_case from DB to camelCase for app
          mediaType: data.mediaType || data.meta?.mediaType || 'image'
      };
      set(state => ({
        imageRecords: state.imageRecords.map(r => r.id === imageId ? updatedRecord : r),
      }));
      toast('Item moved.', 'success');
    }
  },
  toggleStar: async (id) => {
    const record = get().imageRecords.find((r) => r.id === id);
    if (!record) return;

    const currentMeta = record.meta || {};
    const newMeta = { ...currentMeta, isStarred: !currentMeta.isStarred };

    const { error } = await supabase
      .from('image_records')
      .update({ meta: newMeta })
      .eq('id', id);

    if (error) {
      toast('Failed to update star status', 'error');
      console.error(error);
    } else {
      set((state) => ({
        imageRecords: state.imageRecords.map((r) =>
          r.id === id ? { ...r, meta: newMeta } : r
        ),
      }));
      toast(newMeta.isStarred ? 'Added to Favorites' : 'Removed from Favorites', 'success');
    }
  },
}));
