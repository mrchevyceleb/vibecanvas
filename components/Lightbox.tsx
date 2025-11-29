
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageRecord } from '../types';
import { useImageLoader } from '../hooks/useImageLoader';
import { useLibraryStore } from '../store/useLibraryStore';
import { toast } from './ui/Toaster';
import { downloadImage } from '../lib/utils';
import { MODEL_DETAILS } from '../constants';
import { CloseIcon, DownloadIcon, EditIcon, DuplicateIcon, DeleteIcon, RemixIcon, StarIcon, LinkIcon } from './ui/Icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabase/client';

interface LightboxProps {
  imageRecord: ImageRecord;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ imageRecord, onClose }) => {
    const bucket = imageRecord.mediaType === 'video' ? 'video' : 'images';
    const { imageUrl, isLoading, error } = useImageLoader(imageRecord.storage_path, bucket);
    const navigate = useNavigate();
    const { user } = useAuth();
    const { deleteImage, duplicateImage, toggleStar } = useLibraryStore();
    const isStarred = !!imageRecord.meta?.isStarred;
    const isVideo = imageRecord.mediaType === 'video';
    
    const handleDownload = async () => {
        if (imageUrl) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                downloadImage(blob, `vibecanvas-${imageRecord.id}.${isVideo ? 'mp4' : 'png'}`);
                toast('Downloaded.');
            } catch (error) {
                toast('Failed to download.', 'error');
                console.error(error);
            }
        }
    };

    const handleCopyLink = async () => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(imageRecord.storage_path);
        if (data.publicUrl) {
            await navigator.clipboard.writeText(data.publicUrl);
            toast('Public link copied!', 'success');
        } else {
             toast('Could not get public link.', 'error');
        }
    };
    
    const handleEdit = () => {
        navigate(`/edit/${imageRecord.id}`);
    };

    const handleRemixRequest = () => {
        const path = isVideo ? '/video' : '/';
        navigate(path, { state: { remixRecord: imageRecord } });
        onClose();
    };
    
    const handleDuplicate = async () => {
        if (!user) return;
        await duplicateImage(imageRecord.id, user.id);
        toast('Duplicated.');
    };

    const handleDelete = async () => {
        const itemType = isVideo ? 'video' : 'image';
        if (window.confirm(`Are you sure you want to delete this ${itemType}?`)) {
            await deleteImage(imageRecord.id);
            onClose();
        }
    };
    
    const handleToggleStar = async () => {
        await toggleStar(imageRecord.id);
    };

    return (
        <>
            <div 
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in"
                onClick={onClose}
            >
                <div className="w-full h-full flex flex-col lg:flex-row items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                    {/* Image/Video Display Area */}
                    <div className="relative flex-grow w-full h-[70%] lg:h-full lg:w-[70%] flex items-center justify-center bg-black/40 rounded-lg">
                        {isLoading && <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-neon-cyan"></div>}
                        {error && (
                            <div className="flex flex-col items-center text-red-400 p-4 bg-slate-900/50 rounded-lg border border-red-500/20">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                <p className="mt-2 font-bold">Media not found</p>
                                <p className="text-sm text-slate-400 mt-1">{error}</p>
                            </div>
                        )}
                        {imageUrl && !error && (
                            isVideo ? (
                                <video src={imageUrl} controls autoPlay className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50" />
                            ) : (
                                <img src={imageUrl} alt={imageRecord.promptTextAtGen} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50"/>
                            )
                        )}
                        <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors z-10">
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Info and Actions Panel */}
                    <div className="flex-shrink-0 w-full lg:w-[30%] lg:max-w-md h-[30%] lg:h-full bg-slate-900/50 backdrop-blur-lg border-l border-white/10 p-6 overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Details</h2>
                        <div className="space-y-4 text-sm">
                            <div>
                                <h3 className="font-semibold text-gray-400 mb-1">Prompt</h3>
                                <p>{imageRecord.promptTextAtGen}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-400 mb-1">Model</h3>
                                <p>{MODEL_DETAILS[imageRecord.model]?.name || 'Unknown'}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-400 mb-1">Parameters</h3>
                                <p>
                                    Ratio: {imageRecord.params.aspectRatio} | 
                                    Resolution: {imageRecord.params.resolution}
                                </p>
                            </div>
                            {imageRecord.params.negativePrompt && (
                                <div>
                                    <h3 className="font-semibold text-gray-400 mb-1">Negative Prompt</h3>
                                    <p>{imageRecord.params.negativePrompt}</p>
                                </div>
                            )}
                            <div>
                                <h3 className="font-semibold text-gray-400 mb-1">Date</h3>
                                <p>{new Date(imageRecord.createdAt).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="border-t border-white/10 my-6"></div>

                        <h2 className="text-xl font-bold mb-4">Actions</h2>
                        <div className="grid grid-cols-2 gap-3">
                        <ActionButton 
                            onClick={handleToggleStar} 
                            icon={<StarIcon filled={isStarred} />} 
                            label={isStarred ? "Unfavorite" : "Favorite"} 
                            className={`bg-yellow-500/10 hover:bg-yellow-500/20 ${isStarred ? 'text-yellow-300' : 'text-gray-300'}`} 
                            disabled={!!error}
                        />
                        <ActionButton onClick={handleDownload} icon={<DownloadIcon />} label="Download" className={error ? 'opacity-50 cursor-not-allowed' : ''} disabled={!!error}/>
                        <ActionButton onClick={handleCopyLink} icon={<LinkIcon />} label="Copy Link" className={error ? 'opacity-50 cursor-not-allowed' : ''} disabled={!!error}/>
                        {/* FIX: Allow remix for both types */}
                        <ActionButton onClick={handleRemixRequest} icon={<RemixIcon />} label="Remix" className={`bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 ${error ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!!error} />
                        {!isVideo && <ActionButton onClick={handleEdit} icon={<EditIcon />} label="Edit" className={error ? 'opacity-50 cursor-not-allowed' : ''} disabled={!!error}/>}
                        <ActionButton onClick={handleDuplicate} icon={<DuplicateIcon />} label="Duplicate" className={error ? 'opacity-50 cursor-not-allowed' : ''} disabled={!!error}/>
                        <ActionButton onClick={handleDelete} icon={<DeleteIcon />} label="Delete" className="bg-red-800/20 hover:bg-red-500/50 text-red-300" />
                        </div>
                    </div>
                </div>
                <style>{`.animate-fade-in { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
            </div>
        </>
    );
};

const ActionButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, className?: string, disabled?: boolean}> = ({onClick, icon, label, className = '', disabled}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors ${className}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);
