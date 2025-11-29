
import React from 'react';
import { CloseIcon } from './ui/Icons';

interface RemixTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'image' | 'video') => void;
}

export const RemixTypeModal: React.FC<RemixTypeModalProps> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Remix into...</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => onSelect('image')}
                        className="flex flex-col items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-neon-cyan/50 rounded-xl transition-all group"
                    >
                        <div className="p-3 bg-neon-cyan/10 rounded-full text-neon-cyan group-hover:scale-110 transition-transform">
                            {/* Image Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </div>
                        <span className="font-medium">Image</span>
                    </button>

                    <button 
                        onClick={() => onSelect('video')}
                        className="flex flex-col items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-purple-500/50 rounded-xl transition-all group"
                    >
                         <div className="p-3 bg-purple-500/10 rounded-full text-purple-400 group-hover:scale-110 transition-transform">
                            {/* Video Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        </div>
                        <span className="font-medium">Video</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
