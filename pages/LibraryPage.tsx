
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/useLibraryStore';
import { useImageLoader } from '../hooks/useImageLoader';
import { ImageRecord, Folder, ModelId } from '../types';
import { MODEL_DETAILS } from '../constants';
import { Lightbox } from '../components/Lightbox';
import { EditIcon, DeleteIcon, LinkIcon, FolderIcon, CheckIcon, UploadIcon, RemixIcon, StarIcon, DownloadIcon } from '../components/ui/Icons';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/ui/Toaster';
import { supabase } from '../supabase/client';
import { cn, downloadImage } from '../lib/utils';
import { RemixTypeModal } from '../components/RemixTypeModal';

const LibraryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { imageRecords, folders, loading, fetchLibraryContent, createFolder, moveImage, deleteImages, addImage, toggleStar } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewMode, setViewMode] = useState<'image' | 'video'>('image');
  
  const [remixCandidate, setRemixCandidate] = useState<ImageRecord | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
        fetchLibraryContent(user.id);
    }
  }, [user, fetchLibraryContent]);

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete these ${selectedIds.size} items?`)) {
        await deleteImages(Array.from(selectedIds));
        handleClearSelection();
    }
  };
  
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newFolderName && newFolderName.trim()) {
      await createFolder(newFolderName.trim(), user.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };
  
  const handleDropInRoot = (e: React.DragEvent) => {
    e.preventDefault();
    const imageId = e.dataTransfer.getData('imageId');
    if (imageId) {
        moveImage(imageId, null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
        const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
        
        if (mediaType !== viewMode) {
            toast(`Please upload a ${viewMode}. You can switch views to upload a ${mediaType}.`, 'error');
            e.target.value = ''; // Reset file input
            return;
        }

        const model: ModelId = mediaType === 'video' ? 'veo-3.1-generate-preview' : 'gemini-3-pro-image-preview';

        const recordData = {
            model: model,
            params: {
                prompt: 'Uploaded File',
                aspectRatio: '1:1' as const,
                resolution: '1024' as const,
            },
            promptTextAtGen: file.name || 'Uploaded File',
            sourceType: 'upload' as const,
            folder_id: currentFolderId,
            mediaType: mediaType,
        };
        try {
            await addImage(recordData, file, user.id);
            toast(`${mediaType === 'video' ? 'Video' : 'Image'} uploaded to library.`, 'success');
        } catch(error) {
            toast(`Failed to upload ${mediaType}.`, 'error');
            console.error(error);
        }
        // Reset input
        e.target.value = '';
    }
  };

  const handleRemixRequest = (record: ImageRecord) => {
      if (record.mediaType === 'video') {
          navigate('/video', { state: { remixRecord: record } });
      } else {
          setRemixCandidate(record);
      }
  };

  const handleRemixTypeSelect = (type: 'image' | 'video') => {
      if (!remixCandidate) return;
      const path = type === 'video' ? '/video' : '/';
      navigate(path, { state: { remixRecord: remixCandidate } });
      setRemixCandidate(null);
  };

  const { foldersInView, imagesInView, currentFolder } = useMemo(() => {
    const currentFolder = folders.find(f => f.id === currentFolderId) || null;
    
    const filteredImages = imageRecords
      .filter(record => (record.mediaType || 'image') === viewMode)
      .filter(record => record.promptTextAtGen.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Sort so starred items appear first in the library view as well
    filteredImages.sort((a, b) => {
        const aStarred = a.meta?.isStarred ? 1 : 0;
        const bStarred = b.meta?.isStarred ? 1 : 0;
        if (bStarred !== aStarred) {
            return bStarred - aStarred;
        }
        // Fallback to sorting by creation date if star status is the same
        return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
    });
    
    return {
        foldersInView: currentFolderId === null ? folders : [],
        imagesInView: filteredImages.filter(r => r.folder_id === currentFolderId),
        currentFolder,
    };
  }, [imageRecords, folders, searchTerm, currentFolderId, viewMode]);

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex items-center gap-4">
                  <h1 className="text-3xl font-bold">Library</h1>
                  <div className="flex items-center p-1 bg-slate-800/60 border border-slate-700/50 rounded-lg">
                      <button
                          onClick={() => setViewMode('image')}
                          className={cn(
                              'px-3 py-1 text-sm font-semibold rounded-md transition-colors', 
                              viewMode === 'image' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-slate-400 hover:bg-slate-700/50'
                          )}
                      >
                          Images
                      </button>
                      <button
                          onClick={() => setViewMode('video')}
                          className={cn(
                              'px-3 py-1 text-sm font-semibold rounded-md transition-colors',
                              viewMode === 'video' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:bg-slate-700/50'
                          )}
                      >
                          Videos
                      </button>
                  </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                  {isSelectionMode ? (
                      <>
                          <button 
                              onClick={handleDeleteSelected} 
                              disabled={selectedIds.size === 0}
                              className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-opacity text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Delete ({selectedIds.size})
                          </button>
                          <button onClick={handleClearSelection} className="px-4 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm">
                              Cancel
                          </button>
                      </>
                  ) : (
                      <>
                           <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept={viewMode === 'image' ? 'image/*' : 'video/*'}
                            />
                           <button onClick={handleUploadClick} className="px-4 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm flex items-center gap-2">
                                <UploadIcon /> Upload {viewMode === 'image' ? 'Image' : 'Video'}
                          </button>
                          <button onClick={() => setIsSelectionMode(true)} className="px-4 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm">
                              Select
                          </button>
                          {!isCreatingFolder ? (
                              <button onClick={() => setIsCreatingFolder(true)} className="px-4 py-2 bg-neon-cyan text-charcoal font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
                                  New Folder
                              </button>
                          ) : (
                              <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-2">
                                  <input
                                      type="text"
                                      value={newFolderName}
                                      onChange={(e) => setNewFolderName(e.target.value)}
                                      placeholder="Folder name"
                                      autoFocus
                                      className="p-2 bg-slate-800/60 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 text-sm"
                                  />
                                  <button type="submit" className="px-4 py-2 bg-neon-cyan text-charcoal font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
                                      Create
                                  </button>
                                  <button type="button" onClick={() => setIsCreatingFolder(false)} className="px-4 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm">
                                      Cancel
                                  </button>
                              </form>
                          )}
                      </>
                  )}
              </div>
          </div>
          
          <div className="flex items-center gap-2 text-slate-400 mb-4" onDragOver={e => e.preventDefault()} onDrop={handleDropInRoot}>
              <button onClick={() => setCurrentFolderId(null)} className="hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">Library</button>
              {currentFolder && (
                  <>
                      <span>/</span>
                      <span className="font-semibold text-white">{currentFolder.name}</span>
                  </>
              )}
          </div>

          <input
            type="text"
            placeholder={`Search ${viewMode}s by prompt...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md p-2 bg-slate-800/60 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
          />
          
          {loading && <div className="text-center py-16">Loading library...</div>}

          {!loading && (foldersInView.length > 0 || imagesInView.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {foldersInView.map(folder => (
                <FolderCard 
                  key={folder.id}
                  folder={folder}
                  onSelect={() => setCurrentFolderId(folder.id)}
                />
              ))}
              {imagesInView.map(record => (
                <LibraryImageCard 
                  key={record.id} 
                  record={record} 
                  onSelect={() => setSelectedImage(record)}
                  onRemix={(r) => handleRemixRequest(r)}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(record.id)}
                  onToggleSelection={handleToggleSelection}
                  onToggleStar={() => toggleStar(record.id)}
                  folders={folders}
                  onMoveToFolder={(folderId) => moveImage(record.id, folderId)}
                />
              ))}
            </div>
          ) : null}

          {!loading && foldersInView.length === 0 && imagesInView.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700/50 mb-6">
                {viewMode === 'video' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-400" width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z" /><rect x="3" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-neon-cyan" width="24" height="24" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                )}
              </div>
              
              {searchTerm ? (
                <>
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">No results found</h3>
                  <p className="text-slate-500 mb-6">No {viewMode}s match "{searchTerm}"</p>
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="px-4 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm"
                  >
                    Clear search
                  </button>
                </>
              ) : currentFolderId ? (
                <>
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">This folder is empty</h3>
                  <p className="text-slate-500 mb-6">Drag and drop {viewMode}s here to organize them</p>
                  <button 
                    onClick={() => setCurrentFolderId(null)}
                    className="px-4 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm"
                  >
                    ← Back to Library
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">
                    {viewMode === 'video' ? 'No videos yet' : 'No images yet'}
                  </h3>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    {viewMode === 'video' 
                      ? 'Generate videos with Veo 3.1 or Sora 2, or upload your own videos to get started.'
                      : 'Generate images with Nano Banana Pro or GPT-Image-1, or upload your own images to get started.'
                    }
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={() => navigate(viewMode === 'video' ? '/video' : '/')}
                      className="px-5 py-2.5 bg-gradient-to-r from-neon-cyan to-blue-500 text-charcoal font-bold rounded-lg hover:opacity-90 transition-opacity text-sm"
                    >
                      ✨ Generate {viewMode === 'video' ? 'Video' : 'Image'}
                    </button>
                    <button 
                      onClick={handleUploadClick}
                      className="px-5 py-2.5 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors text-sm flex items-center gap-2"
                    >
                      <UploadIcon /> Upload
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {selectedImage && <Lightbox imageRecord={selectedImage} onClose={() => setSelectedImage(null)} />}
      
      <RemixTypeModal 
        isOpen={!!remixCandidate}
        onClose={() => setRemixCandidate(null)}
        onSelect={handleRemixTypeSelect}
      />
    </>
  );
};


const FolderCard: React.FC<{folder: Folder; onSelect: () => void}> = ({ folder, onSelect }) => {
    const { moveImage } = useLibraryStore();
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const imageId = e.dataTransfer.getData('imageId');
        if (imageId) {
            moveImage(imageId, folder.id);
        }
    };
    
    return (
        <div 
            className={`p-4 rounded-2xl bg-slate-800/50 cursor-pointer transition-all duration-300 hover:scale-105 hover:bg-slate-700/60 ${isDragOver ? 'ring-2 ring-neon-cyan' : ''}`}
            onClick={onSelect}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
        >
            <div className="flex items-center gap-3">
                <FolderIcon />
                <span className="font-semibold truncate">{folder.name}</span>
            </div>
        </div>
    );
}

interface LibraryImageCardProps {
    record: ImageRecord;
    onSelect: () => void;
    onRemix: (record: ImageRecord) => void;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onToggleStar: () => void;
    folders: Folder[];
    onMoveToFolder: (folderId: string | null) => void;
}

const LibraryImageCard: React.FC<LibraryImageCardProps> = ({ record, onSelect, onRemix, isSelectionMode, isSelected, onToggleSelection, onToggleStar, folders, onMoveToFolder }) => {
  const bucket = record.mediaType === 'video' ? 'video' : 'images';
  const { imageUrl, isLoading, error } = useImageLoader(record.storage_path, bucket);
  const { deleteImage } = useLibraryStore();
  const navigate = useNavigate();
  const isStarred = !!record.meta?.isStarred;
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(event.target as Node)) {
        setIsFolderMenuOpen(false);
      }
    };

    if (isFolderMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFolderMenuOpen]);

  const handleMoveToFolder = (e: React.MouseEvent, folderId: string | null) => {
    e.stopPropagation();
    onMoveToFolder(folderId);
    setIsFolderMenuOpen(false);
    toast(`Moved to ${folderId ? folders.find(f => f.id === folderId)?.name || 'folder' : 'Library'}.`, 'success');
  };

  const handleFolderButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFolderMenuOpen(!isFolderMenuOpen);
  };

  const handleClick = () => {
    if (isSelectionMode) {
        onToggleSelection(record.id);
    } else {
        if (!error) onSelect();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const itemType = record.mediaType === 'video' ? 'video' : 'image';
    if (window.confirm(`Are you sure you want to delete this ${itemType}?`)) {
        deleteImage(record.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(error) {
        toast('Cannot edit a missing image.', 'error');
        return;
    }
    navigate(`/edit/${record.id}`);
  };
  
  const handleRemix = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(error) {
        toast('Cannot remix a missing image.', 'error');
        return;
    }
    onRemix(record);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { data } = supabase.storage.from(bucket).getPublicUrl(record.storage_path);
    if (data.publicUrl) {
      await navigator.clipboard.writeText(data.publicUrl);
      toast('Public link copied!', 'success');
    } else {
      toast('Could not get public link.', 'error');
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (error || !imageUrl) {
      toast('Cannot download missing media.', 'error');
      return;
    }
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const extension = record.mediaType === 'video' ? 'mp4' : 'png';
      downloadImage(blob, `vibecanvas-${record.id}.${extension}`);
      toast('Downloaded.', 'success');
    } catch (error) {
      toast('Failed to download.', 'error');
      console.error(error);
    }
  };
  
  const handleDragStart = (e: React.DragEvent) => {
    if (isSelectionMode || error) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('imageId', record.id);
  }

  return (
    <div 
        className={cn(
            "relative group overflow-hidden rounded-2xl bg-slate-800/50 transition-transform duration-300",
            !isSelectionMode && !error && "cursor-pointer hover:scale-105",
            isSelectionMode && "cursor-pointer",
            isSelected && "ring-2 ring-offset-2 ring-offset-charcoal ring-neon-cyan scale-105",
            error && "border border-red-500/20"
        )}
        onClick={handleClick}
        draggable={!isSelectionMode && !error}
        onDragStart={handleDragStart}
    >
      {isSelectionMode && (
        <div className="absolute top-2 right-2 z-10 bg-charcoal/50 rounded-full w-6 h-6 flex items-center justify-center pointer-events-none">
            {isSelected ? <CheckIcon /> : <div className="w-4 h-4 rounded-full border-2 border-white/70"></div>}
        </div>
      )}
      {!isSelectionMode && isStarred && (
        <div className="absolute top-2 right-2 z-10 text-yellow-400 drop-shadow-md">
            <StarIcon filled />
        </div>
      )}

      {isLoading ? (
        <div className="aspect-square w-full bg-slate-800/80 animate-pulse"></div>
      ) : error || !imageUrl ? (
        <div className="aspect-square w-full bg-slate-900 flex flex-col items-center justify-center text-slate-600 p-4 text-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
             <p className="text-xs mt-2 font-semibold text-red-400/80">Media Not Found</p>
             <p className="text-[10px] mt-1 text-slate-500 break-words w-full px-2 leading-tight">{error}</p>
        </div>
      ) : (
        record.mediaType === 'video' ? (
             <video 
                src={imageUrl} 
                className="w-full h-full object-cover"
                onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                muted
                loop
            />
        ) : (
            <img src={imageUrl} alt={record.promptTextAtGen} className="w-full h-auto" />
        )
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
        <p className="text-xs text-white/90 line-clamp-4">{record.promptTextAtGen}</p>
        <div className="flex items-center justify-between">
            <span className={cn("text-xs px-2 py-1 rounded-full", 
                record.sourceType === 'upload' ? "bg-blue-500" : (MODEL_DETAILS[record.model]?.badgeColor || 'bg-gray-500')
            )}>
                {record.sourceType === 'upload' ? 'Upload' : (MODEL_DETAILS[record.model]?.badge || 'N/A')}
            </span>
            <div className="flex gap-1">
                 {!error && (
                    <>
                         <button 
                            onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
                            className={cn(
                                "p-1.5 rounded-full transition-colors border border-white/10",
                                isStarred ? "bg-yellow-400/80 text-white hover:bg-yellow-400" : "bg-slate-700/80 text-white hover:bg-yellow-400/50"
                            )}
                            title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                        >
                            <StarIcon filled={isStarred} />
                        </button>
                        <button onClick={handleRemix} title="Remix (Use as Input)" className="p-2 rounded-full bg-purple-500/80 hover:bg-purple-500 transition-colors">
                            <RemixIcon />
                        </button>
                        <button onClick={handleCopyLink} title="Copy public link" className="p-2 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors">
                            <LinkIcon />
                        </button>
                        <button onClick={handleDownload} title="Download" className="p-2 rounded-full bg-slate-600/80 hover:bg-slate-600 transition-colors">
                            <DownloadIcon />
                        </button>
                        <div className="relative" ref={folderMenuRef}>
                            <button 
                                onClick={handleFolderButtonClick} 
                                title="Move to folder" 
                                className="p-2 rounded-full bg-orange-500/80 hover:bg-orange-500 transition-colors"
                            >
                                <FolderIcon />
                            </button>
                            {isFolderMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                                    <button
                                        onClick={(e) => handleMoveToFolder(e, null)}
                                        className={cn(
                                            "w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2",
                                            !record.folder_id && "bg-slate-700/50"
                                        )}
                                    >
                                        <FolderIcon />
                                        <span>Library</span>
                                    </button>
                                    {folders.map(folder => (
                                        <button
                                            key={folder.id}
                                            onClick={(e) => handleMoveToFolder(e, folder.id)}
                                            className={cn(
                                                "w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2",
                                                record.folder_id === folder.id && "bg-slate-700/50"
                                            )}
                                        >
                                            <FolderIcon />
                                            <span className="truncate">{folder.name}</span>
                                        </button>
                                    ))}
                                    {folders.length === 0 && (
                                        <div className="px-4 py-2 text-sm text-slate-400">
                                            No folders yet
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {record.mediaType !== 'video' && (
                            <button onClick={handleEdit} title="Edit" className="p-2 rounded-full bg-blue-500/80 hover:bg-blue-500 transition-colors">
                                <EditIcon />
                            </button>
                        )}
                    </>
                )}
                 <button onClick={handleDelete} title="Delete" className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors">
                    <DeleteIcon />
                </button>
            </div>
        </div>
      </div>
      {record.mediaType === 'video' && (
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-1 rounded-md pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            </div>
        )}
    </div>
  );
};

export default LibraryPage;
