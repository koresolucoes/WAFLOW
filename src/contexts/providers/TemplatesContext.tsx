
import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { MessageTemplate, MessageTemplateInsert } from '../../types';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { createTemplateOnMetaAndDb } from '../../services/templateService';

interface TemplatesContextType {
  templates: MessageTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  createTemplate: (templateData: Omit<MessageTemplateInsert, 'id' | 'user_id' | 'created_at' | 'status' | 'meta_id'>) => Promise<void>;
}

export const TemplatesContext = createContext<TemplatesContextType>(null!);

export const TemplatesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const metaConfig = useMetaConfig();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const createTemplate = useCallback(async (templateData: Omit<MessageTemplateInsert, 'id' | 'user_id' | 'created_at' | 'status' | 'meta_id'>) => {
    if (!user) throw new Error("User not authenticated.");
    if (!metaConfig.wabaId || !metaConfig.accessToken) throw new Error("Meta configuration is missing.");

    const newTemplate = await createTemplateOnMetaAndDb(metaConfig, templateData, user.id);
    setTemplates(prev => [newTemplate, ...prev]);

  }, [user, metaConfig]);

  const value = { templates, setTemplates, createTemplate };
  
  return (
      <TemplatesContext.Provider value={value}>
          {children}
      </TemplatesContext.Provider>
  )
};