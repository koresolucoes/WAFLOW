import { supabase } from '../lib/supabaseClient';
import { Automation, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, AutomationStatus, Json } from '../types';
import { TablesInsert, TablesUpdate, Tables } from '../types/database.types';

export const createAutomationInDb = async (userId: string): Promise<Automation> => {
    const dbAutomation: TablesInsert<'automations'> = { 
        user_id: userId, 
        name: 'Nova Automação (Rascunho)', 
        status: 'paused', 
        nodes: [] as unknown as Json, 
        edges: [] as unknown as Json 
    };
    const { data, error } = await supabase.from('automations').insert(dbAutomation).select('*').single();
    if (error) throw error;
    
    const newAutomationData = data;
    return { 
        ...newAutomationData, 
        nodes: [], 
        edges: [], 
        status: newAutomationData.status as AutomationStatus 
    };
};

export const updateAutomationInDb = async (userId: string, automation: Automation): Promise<Automation> => {
    const updatePayload: TablesUpdate<'automations'> = { 
        name: automation.name, 
        status: automation.status, 
        nodes: automation.nodes as unknown as Json, 
        edges: automation.edges as unknown as Json 
    };
    
    const { data, error } = await supabase
        .from('automations')
        .update(updatePayload)
        .eq('id', automation.id)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;

    const { error: rpcError } = await supabase.rpc('sync_automation_triggers', { automation_id_in: automation.id });
    if (rpcError) {
        console.error("Falha ao sincronizar gatilhos de automação:", rpcError);
    }
    
    const updated = data;
    return { 
        ...updated, 
        nodes: (Array.isArray(updated.nodes) ? updated.nodes : []) as unknown as AutomationNode[], 
        edges: (Array.isArray(updated.edges) ? updated.edges : []) as unknown as Edge[], 
        status: updated.status as AutomationStatus 
    };
};

export const deleteAutomationFromDb = async (automationId: string): Promise<void> => {
    const { error } = await supabase.from('automations').delete().eq('id', automationId);
    if (error) throw error;
};

export const fetchStatsForAutomation = async (automationId: string): Promise<Record<string, AutomationNodeStats>> => {
    const { data, error } = await supabase.from('automation_node_stats').select('*').eq('automation_id', automationId);
    if (error) { 
        console.error("Error fetching automation stats:", error); 
        return {}; 
    }
    const statsData = (data as AutomationNodeStats[]) || [];
    return statsData.reduce((acc, stat) => {
        acc[stat.node_id] = stat;
        return acc;
    }, {} as Record<string, AutomationNodeStats>);
};

export const fetchLogsForNode = async (automationId: string, nodeId: string): Promise<AutomationNodeLog[]> => {
    const { data: runIdsData, error: runIdsError } = await supabase.from('automation_runs').select('id').eq('automation_id', automationId);
    if (runIdsError) { 
        console.error('Error fetching run IDs for logs:', runIdsError); 
        return []; 
    }
    
    const runIds = (runIdsData || []).map(r => r.id);
    if (runIds.length === 0) return [];

    const { data, error } = await supabase.from('automation_node_logs').select('*').in('run_id', runIds).eq('node_id', nodeId).order('created_at', { ascending: false }).limit(100);
    if (error) { 
        console.error("Error fetching node logs:", error); 
        return []; 
    }
    return (data as AutomationNodeLog[]) || [];
};