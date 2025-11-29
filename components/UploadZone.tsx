
import React, { useState, useCallback } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuth } from '../hooks/useAuth';
import { toast } from './ui/Toaster';
import { useImageLoader } from '../hooks/useImageLoader';

interface UploadZoneProps {
    onUploadComplete: (storagePath: string) => void;
    currentImageStoragePath?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUploadComplete, currentImageStoragePath }) => {
    const { user } = useAuth();
    const { uploadFile } = useLibraryStore();
    const [isUploading, setIsUploading] = useState(false);
    const { imageUrl, isLoading: isPreviewLoading, error } = useImageLoader(currentImageStoragePath);

    const handleFile = useCallback(async (file: File) => {
        if (!user) {
            toast('You must be logged in to upload.', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast('Please select an image file.', 'error');
            return;
        }

        setIsUploading(true);
        const result = await uploadFile(file, user.id);
        if (result) {
            onUploadComplete(result.path);
            toast('Image uploaded for img2img.', 'success');
        }
        setIsUploading(false);
    }, [user, uploadFile, onUploadComplete]);

    const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            handleFile(event.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            handleFile(event.target.files[0]);
        }
    };
    
    if (currentImageStoragePath && (imageUrl || error)) {
        return (
             <div className={`bg-slate-800/50 backdrop-blur-lg border rounded-2xl p-4 text-center relative ${error ? 'border-red-500/50' : 'border-slate-700/50'}`}>
                {error ? (
                     <div className="text-red-400 text-sm flex flex-col items-center py-2">
                        <span className="font-bold">Image load failed</span>
                        <span className="text-xs">Please remove or upload a new one.</span>
                     </div>
                ) : (
                     <img src={imageUrl!} className="max-h-24 mx-auto rounded-lg" alt="Upload preview" />
                )}
                
                <button 
                    onClick={() => { onUploadComplete(''); }}
                    className="absolute top-2 right-2 bg-red-500/80 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs"
                >
                   X
                </button>
                {!error && <p className="text-xs mt-2 text-slate-400">Using this image as input.</p>}
            </div>
        )
    }

    return (
        <div 
            onDrop={onDrop} 
            onDragOver={onDragOver}
            className="bg-slate-800/50 backdrop-blur-lg border-2 border-dashed border-slate-700/50 rounded-2xl p-6 text-center cursor-pointer hover:border-neon-cyan/50 transition-colors"
        >
            <input type="file" id="file-upload" className="hidden" onChange={onFileChange} accept="image/*" />
            <label htmlFor="file-upload" className="flex flex-col items-center justify-center gap-2 text-slate-400 cursor-pointer">
                {isUploading ? (
                     <p>Uploading...</p>
                ): (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        <p>
                            <span className="font-semibold text-neon-cyan">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs">an initial image (optional)</p>
                    </>
                )}
            </label>
        </div>
    );
};
