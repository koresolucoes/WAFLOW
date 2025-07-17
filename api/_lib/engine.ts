


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
    console.log(`[Engine Log] Run: ${runId}, Node: ${nodeId}, Status: ${status}, Details: ${details}`);
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
    const logEntry: TablesInsert<'automation_node_logs'> = {
        run_id: runId,
        node_id: nodeId,
        status,
        details
    };
    const { error: logError } = await supabaseAdmin.from('automation_node_logs').insert(logEntry as any);

    if (logError) {
        console.error(`Engine Log Error (Insert): Failed to insert log for node ${nodeId}`, logError);
    }
}


// Main function to execute an automation flow
export const executeAutomation = async (
    automation: Automation,
    contact: Contact | null,
    startNodeId: string,
    trigger: Json | null = null
) => {
    let runId: string | null = null;
    console.log(`[Engine Start] Automation: ${automation.id}, Contact: ${contact?.id}, Trigger: ${startNodeId}`);
    try {
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', automation.user_id)
            .returns<Profile>()
            .single();

        if (profileError || !profileData) {
            throw new Error(`Engine Error: Could not find profile for user ${automation.user_id}. Details: ${profileError?.message}`);
        }
        const profile = profileData;

        const runEntry: TablesInsert<'automation_runs'> = {
            automation_id: automation.id,
            contact_id: contact?.id || null,
            status: 'running',
            details: `Started from trigger node ${startNodeId}`
        };
        const { data: runResult, error: runError } = await supabaseAdmin
            .from('automation_runs')
            .insert(runEntry as any)
            .select('id')
            .returns<{ id: string }>()
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
        const nodeQueue = initialEdges.map(edge => ({ nodeId: edge.target, sourceHandle: edge.sourceHandle || null }));
        
        console.log(`[Engine] Initial queue for automation ${automation.id}:`, nodeQueue.map(n => n.nodeId));
        
        const processedNodes = new Set<string>([startNodeId]); // Start with trigger node already processed
        
        let currentContactState: Contact | null = contact ? { ...contact } : null;

        while (nodeQueue.length > 0) {
            const { nodeId } = nodeQueue.shift()!;
            
            if (processedNodes.has(nodeId)) {
                console.log(`[Engine] Skipping already processed node: ${nodeId}`);
                continue;
            }

            const node = nodes.find(n => n.id === nodeId);
            if (!node) {
                 console.warn(`[Engine Warning] Node with ID ${nodeId} not found in automation ${automation.id}. Skipping.`);
                 continue;
            }
            
            console.log(`[Engine] Processing node ${node.id} (${node.data.label})`);
            processedNodes.add(nodeId);

            const context: ActionContext = {
                profile: profile,
                contact: currentContactState,
                trigger: trigger,
                node,
            };
            
            try {
                const handler = actionHandlers[node.data.type];
                let result: ActionResult = {};

                if (handler) {
                    result = await handler(context);
                    if(result.updatedContact) {
                        currentContactState = result.updatedContact;
                         console.log(`[Engine] Contact state updated for contact ID: ${currentContactState.id}`);
                    }
                } else {
                     result.details = `Nenhuma ação definida para o tipo de nó '${node.data.type}'. Pulando para a próxima etapa.`;
                }
                
                await logNodeExecution(runId, automation.id, nodeId, 'success', result.details || 'Executado com sucesso.');

                const outgoingEdges = edges.filter(e => e.source === nodeId);
                for (const edge of outgoingEdges) {
                    // For conditional nodes, only follow the path that matches the result handle ('yes' or 'no')
                    // For other nodes, follow all outgoing paths (if sourceHandle is null/undefined or matches)
                     if (result.nextNodeHandle) {
                        if(edge.sourceHandle === result.nextNodeHandle){
                           nodeQueue.push({ nodeId: edge.target, sourceHandle: edge.sourceHandle });
                        }
                    } else {
                        nodeQueue.push({ nodeId: edge.target, sourceHandle: edge.sourceHandle });
                    }
                }
                 console.log(`[Engine] Queue after processing node ${node.id}:`, nodeQueue.map(n => n.nodeId));

            } catch (err: any) {
                console.error(`Engine Error on node ${nodeId} in automation ${automation.id}:`, err);
                await logNodeExecution(runId, automation.id, nodeId, 'failed', err.message || 'Ocorreu um erro desconhecido.');
                const updatePayload: TablesUpdate<'automation_runs'> = { status: 'failed', details: `Error on node ${node.data.label}: ${err.message}` };
                await supabaseAdmin.from('automation_runs').update(updatePayload as any).eq('id', runId);
                // Stop the entire flow on first error
                throw err;
            }
        }

        const successUpdatePayload: TablesUpdate<'automation_runs'> = { status: 'success', details: 'Completed successfully.' };
        await supabaseAdmin.from('automation_runs').update(successUpdatePayload as any).eq('id', runId);
         console.log(`[Engine End] Automation ${automation.id} finished successfully.`);

    } catch (e: any) {
        console.error(`[Engine Failure] Automation ${automation.id} failed. Error:`, e.message);
        if (runId) {
             const failureUpdatePayload: TablesUpdate<'automation_runs'> = { status: 'failed', details: `Catastrophic engine failure: ${e.message}` };
             await supabaseAdmin.from('automation_runs').update(failureUpdatePayload as any).eq('id', runId);
        }
    }
};
