
import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { CustomFieldDefinition, CustomFieldDefinitionInsert } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import * as customFieldService from '../../services/customFieldService';

interface CustomFieldsContextType {
    definitions: CustomFieldDefinition[];
    setDefinitions: React.Dispatch<React.SetStateAction<CustomFieldDefinition[]>>;
    addDefinition: (definition: Omit<CustomFieldDefinitionInsert, 'user_id' | 'id' | 'created_at'>) => Promise<void>;
    deleteDefinition: (id: string) => Promise<void>;
}

export const CustomFieldsContext = createContext<CustomFieldsContextType>(null!);

export const CustomFieldsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const user = useAuthStore(state => state.user);
    const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);

    const addDefinition = useCallback(async (definition: Omit<CustomFieldDefinitionInsert, 'user_id' | 'id' | 'created_at'>) => {
        if (!user) throw new Error("User not authenticated.");
        const newDefinition = await customFieldService.addCustomFieldDefinition(user.id, definition);
        setDefinitions(prev => [...prev, newDefinition].sort((a, b) => a.name.localeCompare(b.name)));
    }, [user]);

    const deleteDefinition = useCallback(async (id: string) => {
        if (!user) throw new Error("User not authenticated.");
        await customFieldService.deleteCustomFieldDefinition(id, user.id);
        setDefinitions(prev => prev.filter(def => def.id !== id));
    }, [user]);

    const value = { definitions, setDefinitions, addDefinition, deleteDefinition };

    return (
        <CustomFieldsContext.Provider value={value}>
            {children}
        </CustomFieldsContext.Provider>
    );
};
