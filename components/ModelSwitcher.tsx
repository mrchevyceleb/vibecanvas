
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { imageProviders } from '../services/imageProviders';
import { MODEL_DETAILS } from '../constants';
import { ModelId } from '../types';

const ModelSwitcher: React.FC = () => {
  const { modelId, setModelId } = useSettingsStore();
  const location = useLocation();
  
  const isVideoMode = location.pathname === '/video';

  // Filter providers based on current mode
  const availableProviders = Object.values(imageProviders).filter(provider => {
      const modelType = MODEL_DETAILS[provider.id]?.type || 'image';
      return isVideoMode ? modelType === 'video' : modelType === 'image';
  });

  return (
    <div className="relative">
      <select
        value={modelId}
        onChange={(e) => setModelId(e.target.value as ModelId)}
        className="w-full appearance-none bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan transition-all"
      >
        {availableProviders.map((provider) => (
          <option key={provider.id} value={provider.id} className="bg-slate-900 text-white">
            {MODEL_DETAILS[provider.id]?.name || provider.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  );
};

export default ModelSwitcher;
