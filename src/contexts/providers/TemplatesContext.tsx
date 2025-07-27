import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { MessageTemplate, MessageTemplateInsert } from '../../types';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { createTemplateOnMetaAndDb } from '../../services/templateService';

interface TemplatesContextType {
  templates: MessageTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  createTemplate: (templateData: Omit<MessageTemplateInsert, 'id' | 'team_id' | 'created_at' | 'status' | 'meta_id'>) => Promise<void>;
}

export const TemplatesContext = createContext<TemplatesContextType>(null!);

export const TemplatesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, activeTeam } = useAuthStore();
  const metaConfig = useMetaConfig();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const createTemplate = useCallback(async (templateData: Omit<MessageTemplateInsert, 'id' | 'team_id' | 'created_at' | 'status' | 'meta_id'>) => {
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    if (!metaConfig.wabaId || !metaConfig.accessToken) throw new Error("Meta configuration is missing.");

    const newTemplate = await createTemplateOnMetaAndDb(metaConfig, templateData, activeTeam.id);
    setTemplates(prev => [newTemplate, ...prev]);

  }, [user, activeTeam, metaConfig]);

  const value = { templates, setTemplates, createTemplate };
  
  return (
      <TemplatesContext.Provider value={value}>
          {children}
      </TemplatesContext.Provider>
  )
};
