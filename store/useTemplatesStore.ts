import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Template } from '../types';
import { DEFAULT_TEMPLATES } from '../constants';
import { supabase } from '../supabase/client';
import { toast } from '../components/ui/Toaster';

interface TemplatesState {
  templates: Template[];
  loading: boolean;
  fetchTemplates: (userId: string) => Promise<void>;
  addTemplate: (template: Omit<Template, 'id' | 'createdAt'>, userId: string) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string, userId: string) => Promise<void>;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  loading: true,
  fetchTemplates: async (userId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      toast('Failed to fetch templates', 'error');
      console.error(error);
      set({ templates: DEFAULT_TEMPLATES, loading: false }); // Fallback to defaults
    } else if (data) {
      // Seed default templates if user has none
      if (data.length === 0) {
        const templatesToSeed = DEFAULT_TEMPLATES.map(t => ({...t, user_id: userId, id: uuidv4()}));
        
        // We don't need to await this, can happen in background
        supabase.from('templates').insert(templatesToSeed.map(t => ({...t, params: t.params, created_at: new Date(t.createdAt as number).toISOString() })));

        set({ templates: templatesToSeed, loading: false });
      } else {
        set({ templates: [...DEFAULT_TEMPLATES, ...data], loading: false });
      }
    }
  },
  addTemplate: async (template, userId) => {
    const newTemplate = { ...template, id: uuidv4(), created_at: new Date().toISOString(), user_id: userId, params: template.params };
    const { data, error } = await supabase.from('templates').insert(newTemplate).select().single();
    if (error) {
      toast('Failed to add template', 'error');
      console.error(error);
    } else if (data) {
      set((state) => ({ templates: [...state.templates, data] }));
      toast('Template added!', 'success');
    }
  },
  updateTemplate: async (id, updates) => {
    const { error } = await supabase.from('templates').update(updates).eq('id', id);
    if (error) {
      toast('Failed to update template', 'error');
    } else {
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
      toast('Template updated.', 'success');
    }
  },
  deleteTemplate: async (id) => {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) {
      toast('Failed to delete template', 'error');
    } else {
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }));
      toast('Template deleted.', 'success');
    }
  },
  duplicateTemplate: async (id, userId) => {
    const original = get().templates.find((t) => t.id === id);
    if (!original) return;
    const newTemplateData = {
        name: `${original.name} (Copy)`,
        description: original.description,
        defaultModel: original.defaultModel,
        params: original.params,
        readonly: false,
    };
    await get().addTemplate(newTemplateData, userId);
  },
}));
