

import { supabaseAdmin } from './supabaseAdmin.js';
import { Automation, Contact, Json, Profile } from './types.js';
import { TablesInsert, TablesUpdate } from './database.types.js';
import { actionHandlers, ActionContext, ActionResult } from './automation/actionHandlers.js';


async function logNodeExecution(
    runId: string,
    automationId: string,
    nodeId: string,
    status: 'success' | 'failed',
    details: string
) {
    // Upsert stats using RPC for atomicity
    const { error: rpcError } = await supabaseAdmin.rpc('increment_node_stat', {
        p_automation_id: automationId,
        p_node_id: nodeId,
        p_status: status,
    });
    if (rpcError) {
        console.error(`Engine Log Error (RPC): Failed to increment stat for node ${nodeId}`, rpcError);
    }
    
    // Insert detailed log
    const { error: logError } = await supabaseAdmin.from('automation_node_logs').insert({
        run_id: runId,
        node_id: nodeId,
        status,
        details
    } as TablesInsert<'automation_node_logs'>);

    if (logError) {
        console.error(`Engine Log Error (Insert): Failed to insert log for node ${nodeId}`, logError);
    }
}


// Main function to execute an automation flow
export const executeAutomation = async (
    automation: Automation,
    contact: Contact | null,
    startNodeId: string,
    triggerData: Json | null = null
) => {
    let runId: string | null = null;
    try {
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', automation.user_id)
            .single();

        if (profileError || !profileData) {
            throw new Error(`Engine Error: Could not find profile for user ${automation.user_id}. Details: ${profileError?.message}`);
        }
        const profile = profileData as Profile;

        const { data: runResult, error: runError } = await supabaseAdmin
            .from('automation_runs')
            .insert({
                automation_id: automation.id,
                contact_id: contact?.id || null,
                status: 'running',
                details: `Started from trigger node ${startNodeId}`
            } as TablesInsert<'automation_runs'>)
            .select('id')
            .single();

        if (runError || !runResult) {
            throw new Error(`Engine Error: Failed to create run log for automation ${automation.id}. Details: ${runError?.message}`);
        }
        runId = runResult.id;

        // Log trigger success immediately
        await logNodeExecution(runId, automation.id, startNodeId, 'success', 'Gatilho da automação disparado com sucesso.');

        const nodes = Array.isArray(automation.nodes) ? automation.nodes : [];
        const edges = Array.isArray(automation.edges) ? automation.edges : [];
        
        // Initialize the queue with nodes connected to the trigger
        const initialEdges = edges.filter(e => e.source === startNodeId);
        const nodeQueue = initialEdges.map(edge => ({ nodeId: edge.target }));
        
        const processedNodes = new Set<string>([startNodeId]); // Start with trigger node already processed
        
        let currentContactState: Contact | null = contact ? { ...contact } : null;

        while (nodeQueue.length > 0) {
            const { nodeId } = nodeQueue.shift()!;
            if (processedNodes.has(nodeId)) continue;

            const node = nodes.find(n => n.id === nodeId);
            if (!node) continue;
            
            processedNodes.add(nodeId);

            const context: ActionContext = {
                profile: profile,
                contact: currentContactState,
                triggerData,
                node,
            };
            
            try {
                const handler = actionHandlers[node.data.type];
                let result: ActionResult = {};

                if (handler) {
                    result = await handler(context);
                    if(result.updatedContact) {
                        currentContactState = result.updatedContact;
                    }
                } else {
                     result.details = `Nenhuma ação definida para o tipo de nó '${node.data.type}'. Pulando para a próxima etapa.`;
                }
                
                await logNodeExecution(runId, automation.id, nodeId, 'success', result.details || 'Executado com sucesso.');

                const outgoingEdges = edges.filter(e => e.source === nodeId && (!result.nextNodeHandle || e.sourceHandle === result.nextNodeHandle || !e.sourceHandle));
                for (const edge of outgoingEdges) {
                    nodeQueue.push({ nodeId: edge.target });
                }

            } catch (err: any) {
                console.error(`Engine Error on node ${nodeId} in automation ${automation.id}:`, err);
                await logNodeExecution(runId, automation.id, nodeId, 'failed', err.message || 'Ocorreu um erro desconhecido.');
                await supabaseAdmin.from('automation_runs').update({ status: 'failed', details: `Error on node ${node.data.label}: ${err.message}` } as TablesUpdate<'automation_runs'>).eq('id', runId);
                return; // Stop execution on error
            }
        }

        await supabaseAdmin.from('automation_runs').update({ status: 'success', details: 'Completed successfully.' } as TablesUpdate<'automation_runs'>).eq('id', runId);

    } catch (e: any) {
        console.error("Catastrophic engine failure:", e.message);
        if (runId) {
             await supabaseAdmin.from('automation_runs').update({ status: 'failed', details: `Catastrophic engine failure: ${e.message}` } as TablesUpdate<'automation_runs'>).eq('id', runId);
        }
    }
};
