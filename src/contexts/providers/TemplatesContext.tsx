
import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { MessageTemplate, MessageTemplateInsert, TemplateCategory, TemplateStatus, Json } from '../../types';
import { TablesInsert } from '../../types/database.types';
import { MetaTemplateComponent } from '../../services/meta/types';
import { AuthContext } from './AuthContext';

interface TemplatesContextType {
  templates: MessageTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  addTemplate: (template: MessageTemplateInsert) => Promise<void>;
}

export const TemplatesContext = createContext<TemplatesContextType>(null!);

export const TemplatesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const addTemplate = useCallback(async (template: MessageTemplateInsert) => {
    if (!user) throw new Error("User not authenticated.");
    
    const dbTemplate: TablesInsert<'message_templates'> = {
        ...template,
        components: template.components as unknown as Json,
    };
    
    const { data, error } = await supabase
      .from('message_templates')
      .insert(dbTemplate)
      .select()
      .single();
    if (error) throw error;
    if (data) {
        const newTemplateData = data as any;
        const newTemplate: MessageTemplate = {
            ...newTemplateData,
            category: newTemplateData.category as TemplateCategory,
            status: newTemplateData.status as TemplateStatus,
            components: (newTemplateData.components as unknown as MetaTemplateComponent[]) || []
        };
        setTemplates(prev => [newTemplate, ...prev]);
    }
  }, [user]);

  const value = { templates, setTemplates, addTemplate };
  
  return (
      <TemplatesContext.Provider value={value}>
          {children}
      </TemplatesContext.Provider>
  )
};
