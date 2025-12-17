import React, { useRef, useEffect } from 'react';
import { MODEL_DETAILS } from '../constants';
import { ModelId } from '../types';
import { CheckIcon } from './ui/Icons';
import { cn } from '../lib/utils';

interface ModelSelectorPopupProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'image' | 'video';
    selectedModels: ModelId[];
    onToggleModel: (modelId: ModelId) => void;
    onGenerate: () => void;
    anchorRef?: React.RefObject<HTMLButtonElement>;
}

export const ModelSelectorPopup: React.FC<ModelSelectorPopupProps> = ({
    isOpen,
    onClose,
    mode,
    selectedModels,
    onToggleModel,
    onGenerate,
    anchorRef
}) => {
    const popupRef = useRef<HTMLDivElement>(null);

    // Filter models by current mode
    const availableModels = Object.entries(MODEL_DETAILS).filter(
        ([_, details]) => details.type === mode
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(e.target as Node) &&
                anchorRef?.current &&
                !anchorRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose, anchorRef]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleGenerate = () => {
        if (selectedModels.length > 0) {
            onGenerate();
            onClose();
        }
    };

    return (
        <div
            ref={popupRef}
            className="absolute bottom-full mb-2 right-0 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 p-4 min-w-[280px] animate-fade-in-up z-50"
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Compare Models</h3>
                <span className="text-xs text-slate-400">
                    {selectedModels.length} selected
                </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
                Select which {mode} models to run simultaneously
            </p>

            <div className="space-y-2 mb-4">
                {availableModels.map(([modelId, details]) => {
                    const isSelected = selectedModels.includes(modelId as ModelId);
                    return (
                        <button
                            key={modelId}
                            onClick={() => onToggleModel(modelId as ModelId)}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                                isSelected
                                    ? "bg-neon-cyan/10 border border-neon-cyan/30 text-white"
                                    : "bg-slate-700/50 border border-transparent hover:bg-slate-700 text-slate-300"
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
                                isSelected
                                    ? "bg-neon-cyan text-charcoal"
                                    : "bg-slate-600 border border-slate-500"
                            )}>
                                {isSelected && <CheckIcon />}
                            </div>
                            <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{details.name}</span>
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded-full text-white",
                                        details.badgeColor
                                    )}>
                                        {details.badge}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleGenerate}
                    disabled={selectedModels.length === 0}
                    className={cn(
                        "flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all",
                        selectedModels.length > 0
                            ? "bg-neon-cyan text-charcoal hover:opacity-90 shadow-lg shadow-neon-cyan/20"
                            : "bg-slate-700 text-slate-500 cursor-not-allowed"
                    )}
                >
                    Generate ({selectedModels.length})
                </button>
            </div>
        </div>
    );
};
