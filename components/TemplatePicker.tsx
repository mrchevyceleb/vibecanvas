import React, { useEffect } from 'react';
import { useTemplatesStore } from '../store/useTemplatesStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuth } from '../hooks/useAuth';
// FIX: Import the toast function to display notifications.
import { toast } from './ui/Toaster';

const TemplatePicker: React.FC = () => {
    const { user } = useAuth();
    const { templates, fetchTemplates } = useTemplatesStore();
    const setModelId = useSettingsStore(state => state.setModelId);
    
    useEffect(() => {
        if(user) {
            fetchTemplates(user.id);
        }
    }, [user, fetchTemplates]);

    const handleSelectTemplate = (id: string) => {
        const template = templates.find(t => t.id === id);
        if(template) {
            setModelId(template.defaultModel);
            // In a real app, you would also update the prompt and other params in a generation state store
            console.log("Applied template:", template.name);
            toast('Template applied!', 'success');
        }
    }

    return (
        <div className="relative">
            <select
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full appearance-none bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan transition-all"
              defaultValue=""
            >
                <option value="" disabled>Select a Template...</option>
                {templates.map((template) => (
                    <option key={template.id} value={template.id} className="bg-slate-900 text-white">
                        {template.name} {template.readonly ? ' (default)' : ''}
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

export default TemplatePicker;