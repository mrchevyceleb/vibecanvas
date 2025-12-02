
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGenerationStore } from '../store/useGenerationStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { getProvider, imageProviders } from '../services/imageProviders';
import { toast } from '../components/ui/Toaster';
import { GenParams, ImageRecord, ImageProvider } from '../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useImageLoader } from '../hooks/useImageLoader';
import { Lightbox } from '../components/Lightbox';
import { ASPECT_RATIOS, RESOLUTIONS, RESOLUTION_LABELS, MODEL_DETAILS } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { UploadZone } from '../components/UploadZone';
import { SettingsIcon, UploadIcon, CloseIcon, DownloadIcon, EditIcon, RemixIcon, LinkIcon, DeleteIcon, CompareIcon, StarIcon } from '../components/ui/Icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { downloadImage, cn } from '../lib/utils';
import { supabase } from '../supabase/client';
import { RemixTypeModal } from '../components/RemixTypeModal';

interface HomePageProps {
    mode: 'image' | 'video';
}

const HomePage: React.FC<HomePageProps> = ({ mode }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [initImageStoragePath, setInitImageStoragePath] = useState<string | undefined>(undefined);
    const [initImageBucket, setInitImageBucket] = useState<string>('images');
    const [remixVideoId, setRemixVideoId] = useState<string | undefined>(undefined);
    
    // UI State
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isCompareMode, setIsCompareMode] = useState(false);

    const { 
        modelId, aspectRatio, resolution, soraSeconds, soraSize,
        setAspectRatio, setResolution, setModelId, setSoraSeconds, setSoraSize
    } = useSettingsStore();

    const { isGenerating, results, error, progress, statusMessage, startGeneration, setGenerationSuccess, setGenerationError, clearResults, cancelGeneration } = useGenerationStore();
    const { addImage, imageRecords, fetchLibraryContent, toggleStar } = useLibraryStore();
    
    const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
    const [remixCandidate, setRemixCandidate] = useState<ImageRecord | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Switch default model based on mode
    useEffect(() => {
        const currentModelType = MODEL_DETAILS[modelId]?.type || 'image';
        if (mode === 'video' && currentModelType !== 'video') {
            setModelId('veo-3.1-generate-preview');
        } else if (mode === 'image' && currentModelType !== 'image') {
            setModelId('gemini-3-pro-image-preview');
        }
    }, [mode, modelId, setModelId]);
    
    // Auto-correct aspect ratio when switching to a model with different constraints
    useEffect(() => {
        if (mode === 'video' && modelId !== 'sora-2-video') {
            const supportedRatios = MODEL_DETAILS[modelId]?.supportedAspectRatios;
            if (supportedRatios && !supportedRatios.includes(aspectRatio)) {
                setAspectRatio(supportedRatios[0]);
            }
        }
    }, [modelId, mode, aspectRatio, setAspectRatio]);
    
    // Fetch library on mount to populate "Recent Creations"
    useEffect(() => {
        if (user && imageRecords.length === 0) {
            fetchLibraryContent(user.id);
        }
    }, [user, imageRecords.length, fetchLibraryContent]);

    const handleVoiceResult = useCallback((transcript: string) => {
        setPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
    }, []);
    const { isListening, isAvailable, toggleListening } = useSpeechRecognition(handleVoiceResult);
    
    const { imageUrl: initImageUrl } = useImageLoader(initImageStoragePath, initImageBucket);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; 
            textarea.style.height = `${textarea.scrollHeight}px`; 
        }
    }, [prompt]);

    // Handle Remix Action from Router State
    useEffect(() => {
        if (location.state?.remixRecord) {
            const record = location.state.remixRecord as ImageRecord;
            loadRemixData(record);
            // Clear state so we don't re-remix on refresh
            window.history.replaceState({}, ''); 
        }
    }, [location.state, setSoraSeconds, setSoraSize]);

    const loadRemixData = (record: ImageRecord) => {
        const recordType = record.mediaType || 'image';
        
        setInitImageStoragePath(record.storage_path);
        setInitImageBucket(recordType === 'video' ? 'video' : 'images');
        
        // Handle Video-to-Video Remix (External ID check)
        if (recordType === 'video' && record.meta?.externalId) {
            setRemixVideoId(record.meta.externalId);
        } else {
            setRemixVideoId(undefined);
        }
        
        // If source was generate, preserve prompt. If upload, prompt might be empty.
        if (record.sourceType !== 'upload') {
            setPrompt(record.promptTextAtGen);
        } else {
             if (!prompt) setPrompt('');
        }

        // Restore Sora specific params if available
        if (record.model === 'sora-2-video' && record.meta?.soraParams) {
            if (record.meta.soraParams.seconds) setSoraSeconds(record.meta.soraParams.seconds);
            if (record.meta.soraParams.size) setSoraSize(record.meta.soraParams.size);
        }
        
        toast('Remix mode: Asset loaded.', 'success');
    };

    const handleRemixRequest = (record: ImageRecord) => {
        if (record.mediaType === 'video') {
            // Video always defaults to current video mode remix or navigation to video
            if (mode === 'video') {
                loadRemixData(record);
            } else {
                navigate('/video', { state: { remixRecord: record } });
            }
        } else {
            // If it's an image, ask the user what they want to do
            setRemixCandidate(record);
        }
    };

    const handleRemixTypeSelect = (type: 'image' | 'video') => {
        if (!remixCandidate) return;
        
        if (type === mode) {
            // Stay on current page
            loadRemixData(remixCandidate);
        } else {
            // Navigate to other mode
            const path = type === 'video' ? '/video' : '/';
            navigate(path, { state: { remixRecord: remixCandidate } });
        }
        setRemixCandidate(null);
    };

    const handleClearInit = () => {
        setInitImageStoragePath(undefined);
        setRemixVideoId(undefined);
    };

    // Helper to generate a single request
    const generateWithProvider = async (provider: ImageProvider, params: GenParams) => {
        // Adjust params for models that might need mapping if in Compare Mode
        // e.g. If user set Sora Size 1280x720 (16:9), Veo needs 16:9 aspect ratio.
        // This is ONLY for cross-generating in Compare mode, not normal generation.
        const effectiveParams = { ...params };
        
        // Only apply Sora-specific mapping when generating WITH Sora
        if (provider.id === 'sora-2-video' && !effectiveParams.soraSize) {
             // Map AR to Sora Size for Sora provider
             if (effectiveParams.aspectRatio === '9:16') effectiveParams.soraSize = '720x1280';
             else if (effectiveParams.aspectRatio === '16:9') effectiveParams.soraSize = '1280x720';
             else effectiveParams.soraSize = '1280x720'; // Default
             effectiveParams.seconds = '4'; // Default duration
        }
        // NOTE: Removed the reverse mapping that was overriding aspectRatio for non-Sora providers
        // This was causing the bug where Gemini always got 16:9 regardless of user selection

        const result = await provider.generate(effectiveParams);
        
        const savedImagesPromises = result.images.map(img => 
            addImage({
                model: provider.id, // Save with the actual provider ID
                params: effectiveParams,
                promptTextAtGen: params.prompt,
                sourceType: 'generate',
                meta: img.meta,
                folder_id: null,
                mediaType: mode
            }, img.blob, user!.id)
        );
        
        return (await Promise.all(savedImagesPromises)).filter(Boolean) as ImageRecord[];
    };

    const handleGenerate = async () => {
        if (!user) {
            toast('You must be logged in to generate.', 'error');
            return;
        }
        if (!prompt.trim()) {
            toast('Please enter a prompt.', 'error');
            return;
        }

        startGeneration();

        try {
            let providersToRun: ImageProvider[] = [];

            if (isCompareMode) {
                // Find all providers for the current mode
                providersToRun = Object.values(imageProviders).filter(p => {
                    const type = MODEL_DETAILS[p.id]?.type || 'image';
                    return type === mode;
                });
            } else {
                providersToRun = [getProvider(modelId)];
            }

            // Check configuration for single run (Compare mode skips check to try best effort)
            if (!isCompareMode && !providersToRun[0].isConfigured()) {
                throw new Error(`Model "${providersToRun[0].name}" is not configured.`);
            }

            const params: GenParams = { 
                prompt, 
                negativePrompt, 
                aspectRatio, 
                resolution, 
                initImageStoragePath,
                remixVideoId,
                seconds: soraSeconds,
                soraSize,
            };

            // Run generations in parallel
            const promises = providersToRun.map(p => generateWithProvider(p, params));
            const resultsSettled = await Promise.allSettled(promises);

            const allNewRecords: ImageRecord[] = [];
            let failureCount = 0;

            resultsSettled.forEach(res => {
                if (res.status === 'fulfilled' && res.value) {
                    allNewRecords.push(...res.value);
                } else {
                    failureCount++;
                    if (res.status === 'rejected') console.error(res.reason);
                }
            });

            if (allNewRecords.length > 0) {
                setGenerationSuccess(allNewRecords);
                setPrompt(''); 
                
                if (failureCount > 0) {
                    toast(`Generated with some errors. (${failureCount} failed)`, 'error');
                } else {
                    toast(`${mode === 'video' ? 'Video' : 'Image'} generated successfully!`, 'success');
                }
            } else {
                throw new Error("All generation attempts failed.");
            }

        } catch (e: any) {
            console.error(e);
            const errorMessage = e.message || 'An unknown error occurred.';
            if (useGenerationStore.getState().error !== 'Generation cancelled.') {
                 setGenerationError(errorMessage);
                 toast(errorMessage, 'error');
            }
        }
    };

    const handleCloseResults = () => {
        clearResults();
    };

    // Clear results when route changes (user clicks tabs)
    useEffect(() => {
        // Only clear if we have results and user navigates
        return () => {
            const { results, error, isGenerating } = useGenerationStore.getState();
            if ((results.length > 0 || error) && !isGenerating) {
                clearResults();
            }
        };
    }, [location.pathname]);

    const hasResults = results.length > 0;
    const showHero = isGenerating || hasResults || error;

    // Handle clicking on the backdrop to close results
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking directly on the backdrop, not on children
        if (e.target === e.currentTarget && hasResults && !isGenerating) {
            handleCloseResults();
        }
    };

    // Handle Escape key to close results
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && hasResults && !isGenerating) {
                handleCloseResults();
            }
        };
        
        if (hasResults) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [hasResults, isGenerating]);

    const currentModeRecords = imageRecords.filter(r => (r.mediaType || 'image') === mode);
    const starredRecords = currentModeRecords.filter(r => r.meta?.isStarred);
    const recentRecords = currentModeRecords.filter(r => !r.meta?.isStarred).slice(0, 20);
    
    const availableAspectRatios = MODEL_DETAILS[modelId]?.supportedAspectRatios || ASPECT_RATIOS;
    const availableResolutions = MODEL_DETAILS[modelId]?.supportedResolutions || RESOLUTIONS;

    // Auto-select valid resolution if current one is not supported
    useEffect(() => {
        if (availableResolutions.length > 0 && !availableResolutions.includes(resolution)) {
            setResolution(availableResolutions[0]);
        }
    }, [modelId, resolution, availableResolutions, setResolution]);

    const isSora = modelId === 'sora-2-video';
    
    // Logic to determine if we show the "Settings" button (for negative prompt, etc)
    // Only image mode really uses it right now.
    const showAdvancedButton = mode === 'image';

    return (
        <>
            <div className="relative flex flex-col h-[calc(100dvh-4rem)]">
                
                {/* Main Content Area */}
                <main className="flex-grow overflow-y-auto relative no-scrollbar">
                    
                    {/* MODE A: Hero/Focus View (Active Generation or Results) */}
                    {showHero && (
                        <div 
                            className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in cursor-pointer"
                            onClick={handleBackdropClick}
                        >
                            
                            {/* Hint to click away - only show when results are ready */}
                            {!isGenerating && hasResults && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-slate-500 text-xs flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/5">
                                    <span>Click anywhere or press Esc to close</span>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="text-center z-10 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <div className="w-24 h-24 border-4 border-dashed rounded-full animate-spin border-neon-cyan mx-auto shadow-[0_0_30px_rgba(57,175,255,0.3)]"></div>
                                    <p className="mt-8 text-lg font-medium animate-pulse text-neon-cyan">
                                        {statusMessage || (mode === 'video' ? 'Rendering video...' : 'Dreaming up your visual...')}
                                    </p>
                                    {progress > 0 && (
                                         <div className="mt-2 w-64 bg-slate-800 rounded-full h-2 overflow-hidden mx-auto">
                                            <div className="bg-neon-cyan h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                         </div>
                                    )}
                                    <p className="text-slate-500 text-sm mt-2">
                                        {isCompareMode ? `Using all ${mode} models` : `Using ${MODEL_DETAILS[modelId]?.name}`}
                                    </p>
                                    {mode === 'video' && <p className="text-slate-600 text-xs mt-1">(This takes a few minutes, please wait)</p>}
                                    <button onClick={cancelGeneration} className="mt-6 text-sm text-red-400 hover:text-white underline transition-colors">
                                        Cancel Generation
                                    </button>
                                </div>
                            )}

                            {!isGenerating && error && (
                                <div 
                                    className={cn(
                                        "text-center p-8 bg-slate-800/50 rounded-2xl border max-w-md shadow-2xl backdrop-blur-xl cursor-default",
                                        error === 'Generation cancelled.' ? "border-slate-700" : "border-red-500/20 text-red-400"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="mb-4 flex justify-center"><CloseIcon /></div>
                                    <p className="font-bold text-lg mb-2">
                                        {error === 'Generation cancelled.' ? 'Generation Cancelled' : 'Generation Failed'}
                                    </p>
                                    {error !== 'Generation cancelled.' && <p className="text-sm opacity-80">{error}</p>}
                                    <button onClick={handleCloseResults} className="mt-6 text-sm underline hover:text-white">Return</button>
                                </div>
                            )}

                            {!isGenerating && !error && results.length > 0 && (
                                <div 
                                    className="w-full h-full max-w-6xl flex flex-col items-center justify-center gap-6 cursor-default"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Handle Multiple Results (Comparison) */}
                                    <div className={cn(
                                        "relative w-full flex-grow min-h-0",
                                        results.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto" : "flex items-center justify-center"
                                    )}>
                                        {results.map((res, idx) => (
                                            <div key={res.id} className="relative w-full h-full flex flex-col items-center justify-center">
                                                {results.length > 1 && (
                                                    <span className="absolute top-2 left-2 z-20 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                                                        {MODEL_DETAILS[res.model]?.name}
                                                    </span>
                                                )}
                                                <HeroResult imageRecord={res} onRemix={() => handleRemixRequest(res)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MODE B: Inspiration Gallery (Idle State) */}
                    {!showHero && (
                        <div className="w-full max-w-[1800px] mx-auto p-4 md:p-8 pb-48 md:pb-40 animate-fade-in">
                            
                            {currentModeRecords.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20 backdrop-blur-sm mt-8">
                                    <div className="p-4 bg-slate-800/50 rounded-full mb-4">
                                        <UploadIcon />
                                    </div>
                                    <p className="text-lg font-medium text-slate-400">Your canvas is empty</p>
                                    <p className="text-sm mt-2 max-w-xs text-center">Enter a prompt below to get started.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Favorites Section */}
                                    {starredRecords.length > 0 && (
                                        <div className="mb-10 animate-fade-in">
                                            <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2 mb-4">
                                                <StarIcon filled /> Favorites
                                            </h2>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                                                {starredRecords.map((record) => (
                                                    <GalleryItem 
                                                        key={record.id} 
                                                        record={record} 
                                                        onClick={() => setSelectedImage(record)} 
                                                        onRemix={() => handleRemixRequest(record)}
                                                        onToggleStar={() => toggleStar(record.id)}
                                                        isStarred={true}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recent Creations */}
                                    <div className="mb-6 md:mb-8">
                                        <div>
                                            <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 text-transparent bg-clip-text">Recent Creations</h1>
                                            <p className="text-slate-500 mt-1 text-xs md:text-base">Your recent {mode}s.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                                        {recentRecords.map((record) => (
                                            <GalleryItem 
                                                key={record.id} 
                                                record={record} 
                                                onClick={() => setSelectedImage(record)} 
                                                onRemix={() => handleRemixRequest(record)}
                                                onToggleStar={() => toggleStar(record.id)}
                                                isStarred={false}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
                
                {/* Advanced Settings Panel - Now only for Negative Prompt */}
                {showAdvanced && showAdvancedButton && (
                    <div className="absolute bottom-[180px] md:bottom-28 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20">
                         <div className="bg-slate-800/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 space-y-4 animate-fade-in-up shadow-2xl shadow-black/50">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">Advanced Controls</h3>
                                <button onClick={() => setShowAdvanced(false)} className="text-slate-400 hover:text-white"><CloseIcon /></button>
                            </div>

                            {mode === 'image' && !isSora && (
                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">Negative Prompt</label>
                                    <textarea
                                        value={negativePrompt}
                                        onChange={(e) => setNegativePrompt(e.target.value)}
                                        placeholder="What to avoid (e.g., blurry, distorted, text)"
                                        className="w-full h-16 p-3 bg-slate-900/70 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-cyan border border-slate-700 resize-none transition-colors text-sm"
                                        disabled={isGenerating}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* Bottom Command Bar - RESPONSIVE SPLIT */}
                <footer className="flex-shrink-0 p-2 md:p-4 z-30 bg-charcoal/80 backdrop-blur-sm md:bg-transparent">
                     {/* Mobile Layout (2 Rows) */}
                     <div className="md:hidden flex flex-col gap-3 max-w-4xl mx-auto pb-2">
                         {/* Row 1: Input + Submit */}
                         <div className="flex items-end gap-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-2 relative">
                             <div className="relative flex-grow">
                                {initImageUrl && !isSora && (
                                    <div className="absolute left-3 top-3 z-10 animate-fade-in-scale">
                                        <div className="relative group">
                                            {initImageBucket === 'video' ? (
                                                <video src={initImageUrl} className="h-12 w-12 object-cover rounded-lg border border-white/20 shadow-md" muted />
                                            ) : (
                                                <img src={initImageUrl} className="h-12 w-12 object-cover rounded-lg border border-white/20 shadow-md" alt="Init" />
                                            )}
                                            {remixVideoId && <div className="absolute -bottom-2 left-0 right-0 bg-purple-500 text-[8px] text-center text-white rounded-b-sm uppercase font-bold tracking-wider px-1">Remix</div>}
                                            <button onClick={handleClearInit} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">&times;</button>
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    ref={textareaRef}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={initImageUrl ? (remixVideoId ? "Describe remix changes..." : "Describe changes...") : `Describe ${mode}...`}
                                    className="w-full block bg-transparent text-white px-4 py-3 rounded-2xl focus:outline-none resize-none max-h-32 min-h-[3.5rem] no-scrollbar overflow-hidden focus:overflow-y-auto"
                                    rows={1}
                                    disabled={isGenerating}
                                    style={{ paddingLeft: (initImageUrl && !isSora) ? '4.5rem' : '1rem' }}
                                />
                                <div className="text-[10px] text-slate-500 absolute bottom-1 right-4 pointer-events-none">
                                    {prompt.length} chars
                                </div>
                             </div>
                             <button onClick={handleGenerate} disabled={isGenerating} className="bg-neon-cyan text-charcoal font-bold p-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-cyan/20 flex-shrink-0 h-12 w-12 flex items-center justify-center">
                                {isGenerating ? (
                                    <div className="w-5 h-5 border-2 border-charcoal border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                )}
                            </button>
                         </div>

                         {/* Row 2: Tools (Inline Controls) */}
                         <div className="flex justify-start gap-1 overflow-x-auto no-scrollbar items-center bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
                            {!isSora && (
                                <label htmlFor="file-upload-mobile" className="p-3 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                                    <UploadIcon />
                                </label>
                            )}
                            <input type="file" id="file-upload-mobile" className="hidden" onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const { uploadFile } = useLibraryStore.getState();
                                    if(user) {
                                        uploadFile(file, user.id).then(res => {
                                            if(res) {
                                                setInitImageStoragePath(res.path);
                                                setInitImageBucket('images'); 
                                                setRemixVideoId(undefined); 
                                                toast('Image uploaded!', 'success');
                                            }
                                        });
                                    }
                                }
                            }} accept="image/*" />

                            {isAvailable && (
                                <button onClick={toggleListening} className={`p-3 flex items-center justify-center rounded-xl transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
                                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                                </button>
                            )}

                            <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                            {/* Mobile Params Dropdowns */}
                            {isSora ? (
                                <>
                                    <select 
                                        value={soraSize} 
                                        onChange={(e) => setSoraSize(e.target.value)}
                                        className="bg-transparent text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan max-w-[100px]"
                                    >
                                        <option value="720x1280" className="bg-slate-900">720x1280</option>
                                        <option value="1280x720" className="bg-slate-900">1280x720</option>
                                        <option value="1024x1792" className="bg-slate-900">1024x1792</option>
                                        <option value="1792x1024" className="bg-slate-900">1792x1024</option>
                                    </select>
                                    <select 
                                        value={soraSeconds} 
                                        onChange={(e) => setSoraSeconds(e.target.value as any)}
                                        className="bg-transparent text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan"
                                    >
                                        <option value="4" className="bg-slate-900">4s</option>
                                        <option value="8" className="bg-slate-900">8s</option>
                                        <option value="12" className="bg-slate-900">12s</option>
                                    </select>
                                </>
                            ) : (
                                <>
                                    <select 
                                        value={aspectRatio} 
                                        onChange={(e) => setAspectRatio(e.target.value as any)}
                                        className="bg-transparent text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan"
                                    >
                                        {availableAspectRatios.map(ar => <option key={ar} value={ar} className="bg-slate-900">{ar}</option>)}
                                    </select>
                                    {availableResolutions.length > 1 && (
                                        <select 
                                            value={resolution} 
                                            onChange={(e) => setResolution(e.target.value as any)}
                                            className="bg-transparent text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan max-w-[80px]"
                                        >
                                            {availableResolutions.map(res => (
                                                <option key={res} value={res} className="bg-slate-900">
                                                    {RESOLUTION_LABELS[res] || res}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </>
                            )}
                            
                            <button 
                                onClick={() => setIsCompareMode(!isCompareMode)} 
                                className={cn(
                                    "p-3 rounded-xl transition-colors flex items-center justify-center ml-auto",
                                    isCompareMode ? "text-neon-cyan bg-neon-cyan/10 ring-1 ring-neon-cyan" : "text-gray-400 hover:text-white hover:bg-white/10"
                                )}
                                title="Compare Models"
                            >
                                <CompareIcon />
                            </button>

                            {showAdvancedButton && (
                                <button onClick={() => setShowAdvanced(!showAdvanced)} className={`p-3 flex items-center justify-center rounded-xl transition-colors ${showAdvanced ? 'text-neon-cyan' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
                                    <SettingsIcon />
                                </button>
                            )}
                         </div>
                     </div>

                     {/* Desktop Layout */}
                     <div className="hidden md:block max-w-4xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-2 relative group/footer">
                        <div className="relative flex items-end gap-2">
                            <div className="relative flex-grow">
                                {initImageUrl && !isSora && (
                                    <div className="absolute left-3 top-3 z-10 animate-fade-in-scale">
                                        <div className="relative group">
                                             {initImageBucket === 'video' ? (
                                                <video src={initImageUrl} className="h-12 w-12 object-cover rounded-lg border border-white/20 shadow-md" muted />
                                            ) : (
                                                <img src={initImageUrl} className="h-12 w-12 object-cover rounded-lg border border-white/20 shadow-md" alt="Init" />
                                            )}
                                            {remixVideoId && <div className="absolute -bottom-2 left-0 right-0 bg-purple-500 text-[8px] text-center text-white rounded-b-sm uppercase font-bold tracking-wider px-1">Remix</div>}
                                            <button onClick={handleClearInit} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">&times;</button>
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerate();
                                        }
                                    }}
                                    placeholder={initImageUrl ? (remixVideoId ? "Describe remix changes..." : "Describe changes...") : `Describe ${mode}...`}
                                    className="w-full block bg-transparent text-white px-4 py-3 pr-12 rounded-2xl focus:outline-none resize-none max-h-32 min-h-[3rem] no-scrollbar overflow-hidden focus:overflow-y-auto"
                                    rows={1}
                                    disabled={isGenerating}
                                    style={{ paddingLeft: (initImageUrl && !isSora) ? '4.5rem' : '1rem' }}
                                />
                                <div className="text-[10px] text-slate-500 absolute bottom-1 right-4 pointer-events-none">
                                    {prompt.length} chars
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 pr-2 pb-1">
                                {!isSora && (
                                    <>
                                        <label htmlFor="file-upload-desktop" className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Upload Image">
                                            <UploadIcon />
                                        </label>
                                        <input type="file" id="file-upload-desktop" className="hidden" onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                const file = e.target.files[0];
                                                const { uploadFile } = useLibraryStore.getState();
                                                if(user) {
                                                    uploadFile(file, user.id).then(res => {
                                                        if(res) {
                                                            setInitImageStoragePath(res.path);
                                                            setInitImageBucket('images');
                                                            setRemixVideoId(undefined); // Clear remix on upload
                                                            toast('Image uploaded!', 'success');
                                                        }
                                                    });
                                                }
                                            }
                                        }} accept="image/*" />
                                    </>
                                )}
                                
                                {isAvailable && (
                                    <button onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Voice Input">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                                    </button>
                                )}
                                
                                <div className="h-8 w-[1px] bg-white/10 mx-1"></div>

                                {/* Inline Controls for Desktop */}
                                {isSora ? (
                                    <>
                                        <select 
                                            value={soraSize} 
                                            onChange={(e) => setSoraSize(e.target.value)}
                                            className="bg-slate-800/50 text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan hover:bg-slate-800 transition-colors"
                                            title="Video Size"
                                        >
                                            <option value="720x1280">720x1280</option>
                                            <option value="1280x720">1280x720</option>
                                            <option value="1024x1792">1024x1792</option>
                                            <option value="1792x1024">1792x1024</option>
                                        </select>
                                        <select 
                                            value={soraSeconds} 
                                            onChange={(e) => setSoraSeconds(e.target.value as any)}
                                            className="bg-slate-800/50 text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan hover:bg-slate-800 transition-colors"
                                            title="Duration"
                                        >
                                            <option value="4">4s</option>
                                            <option value="8">8s</option>
                                            <option value="12">12s</option>
                                        </select>
                                    </>
                                ) : (
                                    <>
                                        <select 
                                            value={aspectRatio} 
                                            onChange={(e) => setAspectRatio(e.target.value as any)}
                                            className="bg-slate-800/50 text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan hover:bg-slate-800 transition-colors"
                                            title="Aspect Ratio"
                                        >
                                            {availableAspectRatios.map(ar => <option key={ar} value={ar} className="bg-slate-900">{ar}</option>)}
                                        </select>
                                        {availableResolutions.length > 1 && (
                                            <select 
                                                value={resolution} 
                                                onChange={(e) => setResolution(e.target.value as any)}
                                                className="bg-slate-800/50 text-xs text-gray-300 border border-white/10 rounded-lg px-2 py-2 focus:outline-none focus:border-neon-cyan hover:bg-slate-800 transition-colors"
                                                title="Resolution"
                                            >
                                                {availableResolutions.map(res => (
                                                    <option key={res} value={res} className="bg-slate-900">
                                                        {RESOLUTION_LABELS[res] || res}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </>
                                )}

                                <button 
                                    onClick={() => setIsCompareMode(!isCompareMode)} 
                                    className={cn(
                                        "p-2 rounded-full transition-colors",
                                        isCompareMode ? "bg-neon-cyan text-charcoal ring-2 ring-neon-cyan/50" : "text-gray-400 hover:text-white hover:bg-white/10"
                                    )}
                                    title="Compare All Models"
                                >
                                    <CompareIcon />
                                </button>
                                
                                {showAdvancedButton && (
                                    <button onClick={() => setShowAdvanced(!showAdvanced)} className={`p-2 rounded-full transition-colors ${showAdvanced ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title="Advanced Settings">
                                        <SettingsIcon />
                                    </button>
                                )}
                                
                                <button onClick={handleGenerate} disabled={isGenerating} className="bg-neon-cyan text-charcoal font-bold p-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-cyan/20 hover:shadow-neon-cyan/40 active:scale-95">
                                    {isGenerating ? (
                                        <div className="w-5 h-5 border-2 border-charcoal border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                     </div>
                </footer>
            </div>
            
            {selectedImage && <Lightbox imageRecord={selectedImage} onClose={() => setSelectedImage(null)} />}

            <RemixTypeModal 
                isOpen={!!remixCandidate} 
                onClose={() => setRemixCandidate(null)}
                onSelect={handleRemixTypeSelect}
            />
            
            {/* Styles for hiding scrollbar in textarea but allowing functionality */}
            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </>
    );
};

// --- Subcomponents ---

const HeroResult: React.FC<{ imageRecord: ImageRecord, onRemix: () => void }> = ({ imageRecord, onRemix }) => {
    const bucket = imageRecord.mediaType === 'video' ? 'video' : 'images';
    const { imageUrl, isLoading, error } = useImageLoader(imageRecord.storage_path, bucket);
    const navigate = useNavigate();
    const [isLoaded, setIsLoaded] = useState(false);

    const handleDownload = async () => {
        if (imageUrl) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                downloadImage(blob, `vibecanvas-${imageRecord.id}.${imageRecord.mediaType === 'video' ? 'mp4' : 'png'}`);
                toast('Downloaded to device.', 'success');
            } catch (e) {
                toast('Download failed', 'error');
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

    if (isLoading) return <div className="w-full h-96 flex items-center justify-center"><div className="w-8 h-8 border-2 border-neon-cyan rounded-full animate-spin"></div></div>;
    
    if (error || !imageUrl) return (
        <div className="text-red-400 p-4 border border-red-500/20 rounded-xl bg-slate-900/50 text-center">
            <p className="font-bold mb-2">Failed to load preview</p>
            <p className="text-sm opacity-80">{error}</p>
        </div>
    );

    const isVideo = imageRecord.mediaType === 'video';

    return (
        <div className="relative group flex flex-col items-center max-w-full max-h-full animate-fade-in-up w-full">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-charcoal max-h-[60vh] w-auto">
                {isVideo ? (
                    <video 
                        src={imageUrl} 
                        controls 
                        autoPlay 
                        loop 
                        className="max-w-full max-h-[60vh] object-contain"
                        onLoadedData={() => setIsLoaded(true)}
                    />
                ) : (
                    <img 
                        src={imageUrl} 
                        alt={imageRecord.promptTextAtGen} 
                        className={cn(
                            "max-w-full max-h-[60vh] object-contain transition-opacity duration-500",
                            isLoaded ? "opacity-100" : "opacity-0"
                        )}
                        onLoad={() => setIsLoaded(true)}
                    />
                )}
            </div>
            
            <div className="mt-6 flex flex-wrap justify-center items-center gap-4">
                <button onClick={handleDownload} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-all border border-white/5 hover:border-white/20 shadow-lg">
                    <DownloadIcon /> <span className="hidden sm:inline">Download</span>
                </button>
                <button onClick={handleCopyLink} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-all border border-white/5 hover:border-white/20 shadow-lg">
                    <LinkIcon /> <span className="hidden sm:inline">Copy Link</span>
                </button>
                {!isVideo && (
                    <button onClick={() => navigate(`/edit/${imageRecord.id}`)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-all border border-white/5 hover:border-white/20 shadow-lg">
                        <EditIcon /> <span className="hidden sm:inline">Edit</span>
                    </button>
                )}
                <button onClick={onRemix} className="flex items-center gap-2 px-5 py-2.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan rounded-xl font-medium transition-all border border-neon-cyan/20 shadow-lg shadow-neon-cyan/10">
                    <RemixIcon /> <span className="hidden sm:inline">Remix</span>
                </button>
            </div>
        </div>
    )
}

const GalleryItem: React.FC<{ record: ImageRecord, onClick: () => void, onRemix: () => void, onToggleStar: () => void, isStarred: boolean }> = ({ record, onClick, onRemix, onToggleStar, isStarred }) => {
    const bucket = record.mediaType === 'video' ? 'video' : 'images';
    const { imageUrl, isLoading, error } = useImageLoader(record.storage_path, bucket);
    const { deleteImage } = useLibraryStore();
    const [isLoaded, setIsLoaded] = useState(false);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        const itemType = record.mediaType === 'video' ? 'video' : 'image';
        if (window.confirm(`Are you sure you want to delete this ${itemType}?`)) {
             deleteImage(record.id);
        }
    };

    const handleCopyLink = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const { data } = supabase.storage.from(bucket).getPublicUrl(record.storage_path);
        if (data.publicUrl) {
            await navigator.clipboard.writeText(data.publicUrl);
            toast('Link copied!', 'success');
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

    if (isLoading) return <div className="aspect-square bg-slate-800/50 rounded-xl animate-pulse"></div>;
    if (error || !imageUrl) return null;

    const isVideo = record.mediaType === 'video';

    return (
        <div className="group relative aspect-square rounded-xl overflow-hidden bg-slate-900 cursor-pointer hover:ring-2 hover:ring-neon-cyan/50 transition-all shadow-lg shadow-black/20 hover:shadow-neon-cyan/10" onClick={onClick}>
            {isVideo ? (
                 <video 
                    src={imageUrl} 
                    className="w-full h-full object-cover" 
                    muted
                    loop
                    onMouseOver={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                    onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                    onLoadedData={() => setIsLoaded(true)}
                />
            ) : (
                <img 
                    src={imageUrl} 
                    alt={record.promptTextAtGen} 
                    className={cn(
                        "w-full h-full object-cover transition-all duration-700 group-hover:scale-110",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    loading="lazy" 
                    onLoad={() => setIsLoaded(true)}
                />
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end pointer-events-none">
                <p className="text-white text-xs line-clamp-2 font-medium mb-2">{record.promptTextAtGen}</p>
                <div className="flex items-center justify-between pointer-events-auto">
                    <span className="text-[10px] text-gray-300 bg-white/10 px-2 py-1 rounded-md backdrop-blur-md border border-white/10">
                        {MODEL_DETAILS[record.model]?.name || 'Model'}
                    </span>
                    
                    <div className="hidden md:flex items-center gap-1">
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
                        <button 
                            onClick={handleCopyLink} 
                            className="p-1.5 bg-slate-700/80 text-white rounded-full hover:bg-slate-600 transition-colors border border-white/10"
                            title="Copy Link"
                        >
                            <LinkIcon />
                        </button>
                        <button 
                            onClick={handleDownload} 
                            className="p-1.5 bg-slate-700/80 text-white rounded-full hover:bg-slate-600 transition-colors border border-white/10"
                            title="Download"
                        >
                            <DownloadIcon />
                        </button>
                        <button 
                            onClick={handleDelete} 
                            className="p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-500 transition-colors border border-white/10"
                            title="Delete"
                        >
                            <DeleteIcon />
                        </button>
                        {/* Always show remix */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemix(); }} 
                            className="p-1.5 bg-neon-cyan text-charcoal rounded-full hover:scale-110 transition-transform shadow-md shadow-neon-cyan/30"
                            title="Remix (Use as Input)"
                        >
                            <RemixIcon />
                        </button>
                    </div>
                </div>
            </div>
            {isVideo && (
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-1 rounded-md pointer-events-none">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </div>
            )}
        </div>
    );
}

export default HomePage;
