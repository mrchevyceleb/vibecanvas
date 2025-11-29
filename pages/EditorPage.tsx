
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/useLibraryStore';
import { toast } from '../components/ui/Toaster';
import { ImageRecord } from '../types';
import { blobToBase64 } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabase/client';
import { useImageLoader } from '../hooks/useImageLoader';
import { Lightbox } from '../components/Lightbox';

const MAGICAL_PHRASES = [
    "Weaving your changes into reality...",
    "Consulting the digital muses...",
    "Applying artistic magic...",
    "Transforming the canvas...",
    "Diffusing new possibilities...",
    "Polishing the pixels...",
    "Infusing creativity...",
    "Reimagining the scene..."
];

const EditorPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { getImageRecord, addImage } = useLibraryStore();
    const [originalRecord, setOriginalRecord] = useState<ImageRecord | null>(null);
    const { imageUrl, isLoading: isImageLoading } = useImageLoader(originalRecord?.storage_path);
    const [editPrompt, setEditPrompt] = useState('');
    
    // New state for UI flow
    const [processingStatus, setProcessingStatus] = useState<string | null>(null);
    const [generatedRecord, setGeneratedRecord] = useState<ImageRecord | null>(null);

    useEffect(() => {
        if (id) {
            const record = getImageRecord(id);
            if (record) {
                setOriginalRecord(record);
            } else {
                // If not in store, maybe it hasn't been fetched yet.
                toast('Image not found in local library state.', 'error');
                navigate('/library');
            }
        }
    }, [id, getImageRecord, navigate]);

    const handleSaveChanges = async () => {
        if (!originalRecord || !user || !editPrompt.trim()) {
            toast('Please enter an edit instruction.', 'error');
            return;
        }

        // Pick a random magical phrase
        const randomPhrase = MAGICAL_PHRASES[Math.floor(Math.random() * MAGICAL_PHRASES.length)];
        setProcessingStatus(randomPhrase);

        try {
            // Download original image and convert to base64
            const { data: originalBlob, error: downloadError } = await supabase.storage.from('images').download(originalRecord.storage_path);
            if (downloadError || !originalBlob) {
                throw new Error('Original image blob not found');
            }
            const base64Data = await blobToBase64(originalBlob);

            // Preserve original aspect ratio and resolution from the source image
            const originalAspectRatio = originalRecord.params?.aspectRatio || "1:1";
            const originalResolution = originalRecord.params?.resolution || "1K";
            // Map old resolution formats to new format if needed
            const imageSize = ["1K", "2K", "4K"].includes(originalResolution) 
                ? originalResolution as "1K" | "2K" | "4K"
                : "1K";

            // Call edge function for editing
            const { data, error } = await supabase.functions.invoke('gemini-image', {
                body: { 
                    prompt: editPrompt,
                    aspectRatio: originalAspectRatio,
                    imageSize: imageSize,
                    initImageBase64: base64Data,
                    initImageMimeType: originalBlob.type || 'image/png',
                    isEdit: true,
                },
            });

            if (error) {
                console.error("Gemini Edge Function Error:", error);
                let errorMessage = error.message;
                if (error && typeof error === 'object' && 'context' in error) {
                    const context = (error as any).context;
                    if (context instanceof Response) {
                        try {
                            const errorBody = await context.json();
                            if (errorBody?.error) errorMessage = errorBody.error;
                        } catch (e) {}
                    }
                }
                throw new Error(errorMessage);
            }

            if (!data?.success) {
                throw new Error(data?.error || "Editing failed");
            }

            if (!data.images || data.images.length === 0) {
                throw new Error('Editing failed to produce an image. It may have been blocked for safety reasons.');
            }

            // Convert first image to blob
            const img = data.images[0];
            const dataUrl = `data:${img.mimeType || 'image/png'};base64,${img.b64_json}`;
            const editedBlob = await (await fetch(dataUrl)).blob();

            const newRecord = await addImage({
                model: 'gemini-3-pro-image-preview',
                params: { ...originalRecord.params, prompt: editPrompt },
                promptTextAtGen: `Edited: ${originalRecord.promptTextAtGen}`,
                sourceType: 'edit',
                meta: { ...originalRecord.meta, parentId: originalRecord.id },
                folder_id: originalRecord.folder_id,
                mediaType: 'image',
            }, editedBlob, user.id);
            
            if (newRecord) {
                setGeneratedRecord(newRecord);
                toast('Transformation complete!', 'success');
            } else {
                throw new Error("Failed to save the transformed image.");
            }

        } catch (error: any) {
            console.error('Editing failed:', error);
            toast(error.message || 'An error occurred during editing.', 'error');
        } finally {
            setProcessingStatus(null);
        }
    };

    const handleCloseLightbox = () => {
        setGeneratedRecord(null);
        navigate('/library');
    };

    if (isImageLoading || !imageUrl) {
        return <div className="text-center p-10">Loading editor...</div>;
    }

    const isProcessing = !!processingStatus;

    return (
        <>
            <div className="flex flex-col items-center gap-6 p-4 sm:p-6 lg:p-8 relative min-h-[calc(100vh-5rem)]">
                <h1 className="text-2xl font-bold">Image Editor</h1>
                <p className="text-gray-400">Describe the changes you want to make to the image below.</p>
                <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-4">
                    <img src={imageUrl} alt="Editing" className="max-w-full max-h-[60vh] rounded-lg mx-auto" />
                    <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g., add a llama next to the image, change the background to a sunny day..."
                        className="w-full h-24 p-4 bg-slate-900/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan border border-slate-700 resize-none transition-colors"
                        disabled={isProcessing}
                    />
                </div>
            
                <div className="flex gap-4">
                    <button onClick={() => navigate('/library')} className="px-6 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/80 transition-colors" disabled={isProcessing}>
                        Cancel
                    </button>
                    <button onClick={handleSaveChanges} className="px-6 py-2 bg-neon-cyan text-charcoal font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled={isProcessing}>
                        Generate Edit
                    </button>
                </div>
            </div>

            {/* Magical Loading Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 z-50 bg-charcoal/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative">
                        {/* Spinning blob effect */}
                        <div className="absolute inset-0 bg-neon-cyan/30 rounded-full blur-xl animate-pulse"></div>
                        <div className="w-24 h-24 border-4 border-dashed rounded-full animate-spin border-neon-cyan relative z-10 shadow-[0_0_30px_rgba(57,175,255,0.5)]"></div>
                    </div>
                    <p className="mt-8 text-xl font-medium animate-pulse text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-purple-400">
                        {processingStatus}
                    </p>
                    <p className="text-slate-500 text-sm mt-2">Using Nano Banana Pro</p>
                </div>
            )}

            {/* Result Modal */}
            {generatedRecord && (
                <Lightbox 
                    imageRecord={generatedRecord} 
                    onClose={handleCloseLightbox} 
                />
            )}
        </>
    );
};

export default EditorPage;
