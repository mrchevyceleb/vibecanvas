
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/useLibraryStore';
import { toast } from '../components/ui/Toaster';
import { ImageRecord } from '../types';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabase/client';
import { useImageLoader } from '../hooks/useImageLoader';
import { ensureApiKeySelected } from '../services/imageProviders';
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

        const executeEdit = async (retry: boolean) => {
            try {
                // Check for API key selection requirement for Gemini 3 Pro
                await ensureApiKeySelected();
    
                if (!process.env.API_KEY && !(window as any).aistudio) {
                    throw new Error("API_KEY environment variable not set.");
                }
    
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
                
                const { data: originalBlob, error: downloadError } = await supabase.storage.from('images').download(originalRecord.storage_path);
                if (downloadError || !originalBlob) {
                    throw new Error('Original image blob not found');
                }
                const base64Data = await blobToBase64(originalBlob);
    
                const parts = [
                    { inlineData: { data: base64Data, mimeType: originalBlob.type || 'image/png' } },
                    { text: editPrompt },
                ];
                
                // Use new model for editing
                const response = await ai.models.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: { parts },
                    config: { 
                        // Inherit AR from original if possible, or default
                        imageConfig: {
                             aspectRatio: "1:1", // Default for edit if not mapped
                             imageSize: "1K"
                        }
                    },
                });
    
                let editedBlob: Blob | null = null;
                if (response.candidates?.[0]?.content.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const base64ImageBytes: string = part.inlineData.data;
                            editedBlob = await (await fetch(`data:image/png;base64,${base64ImageBytes}`)).blob();
                            break;
                        }
                    }
                }
    
                if (!editedBlob) {
                    throw new Error('Editing failed to produce an image. It may have been blocked for safety reasons.');
                }
    
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
                const msg = (error.message || error.toString()).toLowerCase();
                const isKeyError = msg.includes("api key") || msg.includes("400") || msg.includes("requested entity was not found");

                if (retry && (window as any).aistudio && isKeyError) {
                     console.warn("API Key invalid or expired. Prompting re-selection.");
                     toast("Invalid API Key. Please select a valid Paid API key.", "error");
                     await (window as any).aistudio.openSelectKey();
                     return executeEdit(false);
                }
                
                console.error('Editing failed:', error);
                const displayMsg = isKeyError 
                    ? "API Key not valid. Please ensure you have selected a valid API key associated with a billing project."
                    : (error.message || 'An error occurred during editing.');
                    
                toast(displayMsg, 'error');
            } finally {
                if (!retry) setProcessingStatus(null);
            }
        };
        
        // Start execution
        // Note: We don't await here inside handleSaveChanges in a way that blocks UI updates, 
        // but executeEdit handles the loading state internally via setProcessingStatus
        await executeEdit(true);
        setProcessingStatus(null);
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
