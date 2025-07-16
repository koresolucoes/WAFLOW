
import { supabaseAdmin } from './supabaseAdmin.js';
import { Automation, Contact, Json, TablesInsert } from './types.js';
import { actionHandlers, ActionContext } from './automation/actionHandlers.js';

// Main function to execute an automation flow
export const executeAutomation = async (
    automation: Automation,
    contact: Contact,
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
        contact_id: contact.id,
        status: 'running',
        details: `Started from node ${startNodeId}`
    };
    const { data: run, error: runError } = await supabaseAdmin.from('automation_runs').insert(runPayload).select().single();

    if (runError || !run) {
        console.error(`Engine Error: Failed to create run log for automation ${automation.id}`, runError);
        return;
    }

    let currentContactState = { ...contact };
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
            profile: profileData,
            contact: currentContactState,
            triggerData,
            node,
        };
        
        try {
            const handler = actionHandlers[node.data.type];
            let nextNodeHandle: string | undefined = undefined;

            if (handler) {
                const result = await handler(context);
                if(result.updatedContact) {
                    currentContactState = result.updatedContact;
                }
                if(result.nextNodeHandle) {
                    nextNodeHandle = result.nextNodeHandle;
                }
            }

            // Find next node(s) in the flow
            const outgoingEdges = edges.filter(e => e.source === nodeId && (!nextNodeHandle || e.sourceHandle === nextNodeHandle || !e.sourceHandle));
            for (const edge of outgoingEdges) {
                nodeQueue.push({ nodeId: edge.target });
            }

        } catch (err: any) {
            console.error(`Engine Error on node ${nodeId} in automation ${automation.id}:`, err);
            await supabaseAdmin.from('automation_runs').update({ status: 'failed', details: `Error on node ${node.data.label}: ${err.message}` }).eq('id', run.id);
            return; // Stop execution on error
        }
    }

    await supabaseAdmin.from('automation_runs').update({ status: 'success', details: 'Completed successfully.' }).eq('id', run.id);
};
