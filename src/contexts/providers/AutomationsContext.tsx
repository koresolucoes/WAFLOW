import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Automation, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, AutomationStatus } from '../../types';
import { Tables } from '../../types/database.types';
import { useAuthStore } from '../../stores/authStore';
import { NavigationContext } from './NavigationContext';
import * as automationService from '../../services/automationService';

interface AutomationsContextType {
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  automationStats: Record<string, AutomationNodeStats>;
  setAutomationStats: React.Dispatch<React.SetStateAction<Record<string, AutomationNodeStats>>>;
  createAndNavigateToAutomation: () => Promise<void>;
  updateAutomation: (automation: Automation) => Promise<void>;
  deleteAutomation: (automationId: string) => Promise<void>;
  fetchAutomationStats: (automationId: string) => Promise<void>;
  fetchNodeLogs: (automationId: string, nodeId: string) => Promise<AutomationNodeLog[]>;
}

export const AutomationsContext = createContext<AutomationsContextType>(null!);

export const AutomationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam } = useAuthStore();
    const { setCurrentPage } = useContext(NavigationContext);
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [automationStats, setAutomationStats] = useState<Record<string, AutomationNodeStats>>({});

    useEffect(() => {
        if (!user || !activeTeam) return;

        const channel = supabase
        .channel('automations-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'automations', filter: `team_id=eq.${activeTeam.id}` },
            (payload) => {
            console.log('Realtime automation change received!', payload);
            if (payload.eventType === 'INSERT') {
                const newAutomation = payload.new as Tables<'automations'>;
                 const sanitized: Automation = {
                    ...newAutomation,
                    nodes: (Array.isArray(newAutomation.nodes) ? newAutomation.nodes : []) as unknown as AutomationNode[],
                    edges: (Array.isArray(newAutomation.edges) ? newAutomation.edges : []) as unknown as Edge[],
                    status: newAutomation.status as AutomationStatus,
                };
                setAutomations(prev => [...prev, sanitized]);
            }
            else if (payload.eventType === 'UPDATE') {
                const updatedAutomation = payload.new as Tables<'automations'>;
                const sanitized: Automation = {
                    ...updatedAutomation,
                    nodes: (Array.isArray(updatedAutomation.nodes) ? updatedAutomation.nodes : []) as unknown as AutomationNode[],
                    edges: (Array.isArray(updatedAutomation.edges) ? updatedAutomation.edges : []) as unknown as Edge[],
                    status: updatedAutomation.status as AutomationStatus,
                };
                setAutomations(prev => prev.map(a => a.id === sanitized.id ? sanitized : a));
            } else if (payload.eventType === 'DELETE') {
                const deletedAutomation = payload.old as Partial<Tables<'automations'>>;
                if (deletedAutomation && deletedAutomation.id) {
                    setAutomations(prev => prev.filter(a => a.id !== deletedAutomation.id));
                }
            }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') console.log('Successfully subscribed to automations channel.');
            if (err) console.error('Error subscribing to automations channel:', err);
        });
        
        return () => {
            supabase.removeChannel(channel);
        }

    }, [user, activeTeam]);

    const createAndNavigateToAutomation = useCallback(async () => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        const newAutomation = await automationService.createAutomationInDb(activeTeam.id);
        setCurrentPage('automation-editor', { automationId: newAutomation.id });
    }, [user, activeTeam, setCurrentPage]);

    const updateAutomation = useCallback(async (automation: Automation) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        const updated = await automationService.updateAutomationInDb(activeTeam.id, automation);
        setAutomations(prev => prev.map(a => a.id === updated.id ? updated : a));
    }, [user, activeTeam]);
    
    const deleteAutomation = useCallback(async (automationId: string) => {
        if (!user) throw new Error("User not authenticated.");
        await automationService.deleteAutomationFromDb(automationId);
        // Realtime handles state update
    }, [user]);
    
    const fetchAutomationStats = useCallback(async (automationId: string) => {
        if (!user) return;
        const statsMap = await automationService.fetchStatsForAutomation(automationId);
        setAutomationStats(prev => ({...prev, ...statsMap}));
    }, [user]);

    const fetchNodeLogs = useCallback(async (automationId: string, nodeId: string): Promise<AutomationNodeLog[]> => {
        if (!user) return [];
        return await automationService.fetchLogsForNode(automationId, nodeId);
    }, [user]);

    const value = {
        automations,
        setAutomations,
        automationStats,
        setAutomationStats,
        createAndNavigateToAutomation,
        updateAutomation,
        deleteAutomation,
        fetchAutomationStats,
        fetchNodeLogs
    };

    return (
        <AutomationsContext.Provider value={value}>
            {children}
        </AutomationsContext.Provider>
    )
};
