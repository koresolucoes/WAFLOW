import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Automation, AutomationInsert, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, AutomationStatus, Json } from '../../types';
import { Tables, TablesInsert, TablesUpdate } from '../../types/database.types';
import { AuthContext } from './AuthContext';
import { NavigationContext } from './NavigationContext';

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
    const { user } = useContext(AuthContext);
    const { setCurrentPage } = useContext(NavigationContext);
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [automationStats, setAutomationStats] = useState<Record<string, AutomationNodeStats>>({});

    useEffect(() => {
        if (!user) return;

        const channel = supabase
        .channel('automations-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'automations', filter: `user_id=eq.${user.id}` },
            (payload) => {
            console.log('Realtime automation change received!', payload);
            if (payload.eventType === 'INSERT') {
                const newAutomation = payload.new as Tables<'automations'>;
                 const sanitized: Automation = {
                    ...newAutomation,
                    nodes: (Array.isArray(newAutomation.nodes) ? newAutomation.nodes : []) as AutomationNode[],
                    edges: (Array.isArray(newAutomation.edges) ? newAutomation.edges : []) as Edge[],
                    status: newAutomation.status as AutomationStatus,
                };
                setAutomations(prev => [...prev, sanitized]);
            }
            else if (payload.eventType === 'UPDATE') {
                const updatedAutomation = payload.new as Tables<'automations'>;
                const sanitized: Automation = {
                    ...updatedAutomation,
                    nodes: (Array.isArray(updatedAutomation.nodes) ? updatedAutomation.nodes : []) as AutomationNode[],
                    edges: (Array.isArray(updatedAutomation.edges) ? updatedAutomation.edges : []) as Edge[],
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

    }, [user]);

    const createAndNavigateToAutomation = useCallback(async () => {
        if (!user) throw new Error("User not authenticated.");
        const dbAutomation: TablesInsert<'automations'> = { user_id: user.id, name: 'Nova Automação (Rascunho)', status: 'paused', nodes: [] as unknown as Json, edges: [] as unknown as Json };
        const { data, error } = await supabase.from('automations').insert(dbAutomation as any).select().single();

        if (error) throw error;
        if (data) {
            const newAutomationData = data as Tables<'automations'>;
            const newAutomation: Automation = { ...newAutomationData, nodes: [], edges: [], status: newAutomationData.status as AutomationStatus };
            setAutomations(prev => [newAutomation, ...prev]);
            setCurrentPage('automation-editor', { automationId: newAutomation.id });
        }
    }, [user, setCurrentPage]);

    const updateAutomation = useCallback(async (automation: Automation) => {
        if (!user) throw new Error("User not authenticated.");
        const updatePayload: TablesUpdate<'automations'> = { name: automation.name, status: automation.status, nodes: automation.nodes as unknown as Json, edges: automation.edges as unknown as Json };
        
        const { data, error } = await supabase.from('automations').update(updatePayload as any).eq('id', automation.id).eq('user_id', user.id).select().single();
        if(error) throw error;

        const { error: rpcError } = await supabase.rpc('sync_automation_triggers', { automation_id_in: automation.id });
        if (rpcError) {
            console.error("Falha ao sincronizar gatilhos de automação:", rpcError);
        }

        if(data) {
            const updatedAutomationData = data as Tables<'automations'>;
            const updatedAutomation: Automation = { ...updatedAutomationData, nodes: (Array.isArray(updatedAutomationData.nodes) ? updatedAutomationData.nodes : []) as AutomationNode[], edges: (Array.isArray(updatedAutomationData.edges) ? updatedAutomationData.edges : []) as Edge[], status: updatedAutomationData.status as AutomationStatus };
            setAutomations(prev => prev.map(a => a.id === updatedAutomation.id ? updatedAutomation : a));
        }
    }, [user]);
    
    const deleteAutomation = useCallback(async (automationId: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { error } = await supabase.from('automations').delete().eq('id', automationId);
        if (error) throw error;
    }, [user]);
    
    const fetchAutomationStats = useCallback(async (automationId: string) => {
        if (!user) return;
        const { data, error } = await supabase.from('automation_node_stats').select('*').eq('automation_id', automationId);
        if (error) { console.error("Error fetching automation stats:", error); return; }
        if (data) {
            const statsMap = (data as AutomationNodeStats[]).reduce((acc, stat) => { acc[stat.node_id] = stat; return acc; }, {} as Record<string, AutomationNodeStats>);
            setAutomationStats(prev => ({...prev, ...statsMap}));
        }
    }, [user]);

    const fetchNodeLogs = useCallback(async (automationId: string, nodeId: string): Promise<AutomationNodeLog[]> => {
        if (!user) return [];
        
        const { data: runIdsData, error: runIdsError } = await supabase.from('automation_runs').select('id').eq('automation_id', automationId);
        if (runIdsError || !runIdsData) { console.error('Error fetching run IDs for logs:', runIdsError); return []; }
        const runIds = (runIdsData as { id: string }[]).map(r => r.id);
        if (runIds.length === 0) return [];
        const { data, error } = await supabase.from('automation_node_logs').select('*').in('run_id', runIds).eq('node_id', nodeId).order('created_at', { ascending: false }).limit(100);
        if (error) { console.error("Error fetching node logs:", error); return []; }
        return (data as AutomationNodeLog[]) || [];
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
