

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { CustomFieldDefinition, CustomFieldDefinitionInsert } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import * as customFieldService from '../../services/customFieldService';

interface CustomFieldsContextType {
    definitions: CustomFieldDefinition[];
    setDefinitions: React.Dispatch<React.SetStateAction<CustomFieldDefinition[]>>;
    addDefinition: (definition: Omit<CustomFieldDefinitionInsert, 'team_id' | 'id' | 'created_at'>) => Promise<void>;
    deleteDefinition: (id: string) => Promise<void>;
}

export const CustomFieldsContext = createContext<CustomFieldsContextType>(null!);

export const CustomFieldsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { activeTeam } = useAuthStore();
    const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);

    const addDefinition = useCallback(async (definition: Omit<CustomFieldDefinitionInsert, 'team_id' | 'id' | 'created_at'>) => {
        if (!activeTeam) throw new Error("Active team not available.");
        const newDefinition = await customFieldService.addCustomFieldDefinition(activeTeam.id, definition);
        setDefinitions(prev => [...prev, newDefinition].sort((a, b) => a.name.localeCompare(b.name)));
    }, [activeTeam]);

    const deleteDefinition = useCallback(async (id: string) => {
        if (!activeTeam) throw new Error("Active team not available.");
        await customFieldService.deleteCustomFieldDefinition(id, activeTeam.id);
        setDefinitions(prev => prev.filter(def => def.id !== id));
    }, [activeTeam]);

    const value = { definitions, setDefinitions, addDefinition, deleteDefinition };

    return (
        <CustomFieldsContext.Provider value={value}>
            {children}
        </CustomFieldsContext.Provider>
    );
};