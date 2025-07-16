





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
    });
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
    const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', automation.user_id)
        .single();

    if (profileError || !profileData) {
        console.error(`Engine Error: Could not find profile for user ${automation.user_id}`, profileError);
        return;
    }

    const runPayload: TablesInsert<'automation_runs'> = {
        automation_id: automation.id,
        contact_id: contact?.id || null,
        status: 'running',
        details: `Started from node ${startNodeId}`
    };
    const { data: runResult, error: runError } = await supabaseAdmin.from('automation_runs').insert(runPayload).select().single();

    if (runError || !runResult) {
        console.error(`Engine Error: Failed to create run log for automation ${automation.id}`, runError);
        return;
    }
    const run = runResult;

    let currentContactState: Contact | null = contact ? { ...contact } : null;
    const nodes = Array.isArray(automation.nodes) ? automation.nodes : [];
    const edges = Array.isArray(automation.edges) ? automation.edges : [];
    const nodeQueue: { nodeId: string }[] = [{ nodeId: startNodeId }];
    const processedNodes = new Set<string>();

    while (nodeQueue.length > 0) {
        const { nodeId } = nodeQueue.shift()!;
        if (processedNodes.has(nodeId)) continue; // Avoid infinite loops

        const node = nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        processedNodes.add(nodeId); // Mark as processed for this run

        const context: ActionContext = {
            profile: profileData as Profile,
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
            }
            
            await logNodeExecution(run.id, automation.id, nodeId, 'success', result.details || 'Executado com sucesso.');

            // Find next node(s) in the flow
            const outgoingEdges = edges.filter(e => e.source === nodeId && (!result.nextNodeHandle || e.sourceHandle === result.nextNodeHandle || !e.sourceHandle));
            for (const edge of outgoingEdges) {
                nodeQueue.push({ nodeId: edge.target });
            }

        } catch (err: any) {
            console.error(`Engine Error on node ${nodeId} in automation ${automation.id}:`, err);
            await logNodeExecution(run.id, automation.id, nodeId, 'failed', err.message || 'Ocorreu um erro desconhecido.');
            await supabaseAdmin.from('automation_runs').update({ status: 'failed', details: `Error on node ${node.data.label}: ${err.message}` }).eq('id', run.id);
            return; // Stop execution on error
        }
    }

    await supabaseAdmin.from('automation_runs').update({ status: 'success', details: 'Completed successfully.' }).eq('id', run.id);
};