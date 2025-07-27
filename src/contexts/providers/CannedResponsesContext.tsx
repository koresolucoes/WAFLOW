import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CannedResponse, CannedResponseInsert } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import * as cannedResponseService from '../../services/cannedResponseService';
import { TablesUpdate } from '../../types/database.types';

interface CannedResponsesContextType {
    responses: CannedResponse[];
    setResponses: React.Dispatch<React.SetStateAction<CannedResponse[]>>;
    addResponse: (response: Omit<CannedResponseInsert, 'team_id' | 'id' | 'created_at'>) => Promise<void>;
    updateResponse: (id: string, updates: TablesUpdate<'canned_responses'>) => Promise<void>;
    deleteResponse: (id: string) => Promise<void>;
}

export const CannedResponsesContext = createContext<CannedResponsesContextType>(null!);

export const CannedResponsesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam } = useAuthStore();
    const [responses, setResponses] = useState<CannedResponse[]>([]);

    useEffect(() => {
        if (user && activeTeam) {
            cannedResponseService.fetchCannedResponses(activeTeam.id)
                .then(setResponses)
                .catch(err => console.error("Failed to fetch canned responses:", err));
        } else {
            setResponses([]);
        }
    }, [user, activeTeam]);

    const addResponse = useCallback(async (response: Omit<CannedResponseInsert, 'team_id' | 'id' | 'created_at'>) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        const newResponse = await cannedResponseService.addCannedResponse(activeTeam.id, response);
        setResponses(prev => [...prev, newResponse].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
    }, [user, activeTeam]);

    const updateResponse = useCallback(async (id: string, updates: TablesUpdate<'canned_responses'>) => {
        const updatedResponse = await cannedResponseService.updateCannedResponse(id, updates);
        setResponses(prev => prev.map(r => r.id === id ? updatedResponse : r).sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
    }, []);
    
    const deleteResponse = useCallback(async (id: string) => {
        await cannedResponseService.deleteCannedResponse(id);
        setResponses(prev => prev.filter(r => r.id !== id));
    }, []);

    const value = {
        responses,
        setResponses,
        addResponse,
        updateResponse,
        deleteResponse
    };

    return (
        <CannedResponsesContext.Provider value={value}>
            {children}
        </CannedResponsesContext.Provider>
    );
};
