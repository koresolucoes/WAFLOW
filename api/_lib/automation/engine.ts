import { supabaseAdmin } from '../supabaseAdmin.js';
import { Automation, Contact, Json, Profile } from '../types.js';
import { TablesInsert } from '../database.types.js';
import { actionHandlers } from './handlers/index.js';
import { ActionResult } from './types.js';
import { ExecutionLifecycleHooks } from './ExecutionLifecycleHooks.js';

/**
 * Creates and configures a default set of lifecycle hooks for logging automation runs.
 * This decouples the logging mechanism from the execution engine itself.
 */
export const createDefaultLoggingHooks = (automationId: string, contactId: string | null, teamId: string): ExecutionLifecycleHooks => {
    const hooks = new ExecutionLifecycleHooks();
    let runId: string | null = null;

    hooks.addHandler('workflowExecuteBefore', async () => {
        const { data, error } = await supabaseAdmin.from('automation_runs').insert({
            automation_id: automationId,
            contact_id: contactId,
            team_id: teamId,
            status: 'running'
        } as any).select('id').single();

        if (error) {
            console.error(`[Execution Logging] Failed to create automation_run record for automation ${automationId}`, error);
            throw new Error('Failed to start execution log.');
        }
        if (!data) {
            throw new Error('Failed to retrieve automation run ID after creation.');
        }
        runId = (data as any).id;
    });

    hooks.addHandler('workflowExecuteAfter', async (status, details) => {
        if (!runId) return;
        await supabaseAdmin.from('automation_runs').update({ status, details } as any).eq('id', runId);
    });

    hooks.addHandler('nodeExecuteBefore', async (_node) => {
        // This could be used for more granular, real-time logging if needed in the future.
    });

    hooks.addHandler('nodeExecuteAfter', async (node, status, details) => {
        if (!runId) return;
        const logEntry: TablesInsert<'automation_node_logs'> = {
            run_id: runId,
            node_id: node.id,
            team_id: teamId,
            status,
            details,
        };
        const { error: logError } = await supabaseAdmin.from('automation_node_logs').insert(logEntry as any);
        if (logError) {
            console.error(`[Execution Logging] Failed to create node log for node ${node.id} in run ${runId}`, logError);
        }

        const { error: rpcError } = await supabaseAdmin.rpc('increment_node_stat', {
            p_automation_id: automationId,
            p_node_id: node.id,
            p_team_id: teamId,
            p_status: status,
        });
        if (rpcError) {
            console.error(`[Execution Logging] Failed to update node stats for node ${node.id} in run ${runId}`, rpcError);
        }
    });

    return hooks;
};

/**
 * The core engine for executing an automation workflow.
 */
export const executeAutomation = async (
    automation: Automation,
    contact: Contact | null,
    startNodeId: string,
    trigger: Json | null,
    profile: Profile
): Promise<void> => {
    
    let currentContact = contact;
    const { id: automationId, team_id: teamId, nodes, edges } = automation;
    const hooks = createDefaultLoggingHooks(automationId, currentContact?.id || null, teamId);

    try {
        await hooks.runHook('workflowExecuteBefore');
        
        const nodesMap = new Map(nodes.map(node => [node.id, node]));
        const edgesMap = new Map();
        edges.forEach(edge => {
            const key = edge.sourceHandle ? `${edge.source}-${edge.sourceHandle}` : edge.source;
            edgesMap.set(key, edge.target);
        });
        
        let currentNode = nodesMap.get(startNodeId);
        
        while (currentNode) {
            let nextNodeId: string | undefined;
            let result: ActionResult = {};

            try {
                await hooks.runHook('nodeExecuteBefore', currentNode);
                const handler = actionHandlers[currentNode.data.type];
                if (!handler) {
                    throw new Error(`No handler found for node type: ${currentNode.data.type}`);
                }
                
                result = await handler({
                    profile,
                    contact: currentContact,
                    trigger,
                    node: currentNode,
                    automationId,
                    teamId,
                });

                await hooks.runHook('nodeExecuteAfter', currentNode, 'success', result.details || 'Executed successfully.');
                
                if (result.updatedContact) {
                    currentContact = result.updatedContact;
                }

                const edgeMapKey = result.nextNodeHandle ? `${currentNode.id}-${result.nextNodeHandle}` : currentNode.id;
                nextNodeId = edgesMap.get(edgeMapKey);

            } catch (nodeError: any) {
                await hooks.runHook('nodeExecuteAfter', currentNode, 'failed', nodeError.message);
                throw nodeError; // Stop the whole workflow on node error
            }

            currentNode = nextNodeId ? nodesMap.get(nextNodeId) : undefined;
        }

        await hooks.runHook('workflowExecuteAfter', 'success', 'Workflow completed.');

    } catch (workflowError: any) {
        console.error(`[Execution Engine] Workflow failed for automation ${automationId}:`, workflowError.message);
        await hooks.runHook('workflowExecuteAfter', 'failed', workflowError.message);
    }
};