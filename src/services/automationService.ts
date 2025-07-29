import { supabase } from '../lib/supabaseClient';
import { Automation, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, AutomationStatus, Json } from '../types';
import { TablesInsert, TablesUpdate, Tables } from '../types/database.types';

export const createAutomationInDb = async (teamId: string): Promise<Automation> => {
    const dbAutomation: TablesInsert<'automations'> = { 
        team_id: teamId, 
        name: 'Nova Automação (Rascunho)', 
        status: 'paused', 
        nodes: [] as unknown as Json, 
        edges: [] as unknown as Json 
    };
    const { data, error } = await supabase.from('automations').insert(dbAutomation as any).select('*').single();
    if (error) throw error;
    
    const newAutomationData = data as any;
    return { 
        ...newAutomationData, 
        nodes: [], 
        edges: [], 
        status: newAutomationData.status as AutomationStatus 
    };
};

export const updateAutomationInDb = async (teamId: string, automation: Automation): Promise<Automation> => {
    const updatePayload: TablesUpdate<'automations'> = { 
        name: automation.name, 
        status: automation.status, 
        nodes: automation.nodes as unknown as Json, 
        edges: automation.edges as unknown as Json 
    };
    
    const { data, error } = await supabase
        .from('automations')
        .update(updatePayload as any)
        .eq('id', automation.id)
        .eq('team_id', teamId)
        .select('*')
        .single();

    if (error) throw error;

    const { error: rpcError } = await supabase.rpc('sync_automation_triggers', { automation_id_in: automation.id });
    if (rpcError) {
        console.error("Falha ao sincronizar gatilhos de automação:", rpcError);
    }
    
    const updated = data as any;
    return { 
        ...updated, 
        nodes: (Array.isArray(updated.nodes) ? updated.nodes : []) as unknown as AutomationNode[], 
        edges: (Array.isArray(updated.edges) ? updated.edges : []) as unknown as Edge[], 
        status: updated.status as AutomationStatus 
    };
};

export const deleteAutomationFromDb = async (automationId: string, teamId: string): Promise<void> => {
    const { error } = await supabase.from('automations').delete().eq('id', automationId).eq('team_id', teamId);
    if (error) throw error;
};

export const fetchStatsForAutomation = async (automationId: string): Promise<Record<string, AutomationNodeStats>> => {
    const { data, error } = await supabase.from('automation_node_stats').select('automation_id, node_id, success_count, error_count, last_run_at').eq('automation_id', automationId);
    if (error) { 
        console.error("Error fetching automation stats:", error); 
        return {}; 
    }
    const statsData = (data as any as AutomationNodeStats[]) || [];
    return statsData.reduce((acc, stat) => {
        acc[stat.node_id] = stat;
        return acc;
    }, {} as Record<string, AutomationNodeStats>);
};

export const fetchLogsForNode = async (automationId: string, nodeId: string): Promise<AutomationNodeLog[]> => {
    // A política RLS em `automation_runs` (is_team_member(team_id)) garante que apenas os
    // dados da equipe correta sejam retornados. Não é necessário um join explícito para segurança.
    const { data: runIdsData, error: runIdsError } = await supabase
        .from('automation_runs')
        .select('id')
        .eq('automation_id', automationId);
        
    if (runIdsError) { 
        console.error('Error fetching run IDs for logs:', runIdsError); 
        return []; 
    }
    
    const runIds = ((runIdsData || []) as any[]).map(r => r.id);
    if (runIds.length === 0) return [];

    // A política RLS em `automation_node_logs` também protege esta consulta.
    const { data, error } = await supabase
        .from('automation_node_logs')
        .select('id, run_id, node_id, status, details, created_at')
        .in('run_id', runIds)
        .eq('node_id', nodeId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) { 
        console.error("Error fetching node logs:", error); 
        return []; 
    }
    return (data as any as AutomationNodeLog[]) || [];
};