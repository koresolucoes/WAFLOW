
import { supabaseAdmin } from '../supabaseAdmin.js';
import { Automation, Contact, Json, AutomationNode, Profile, TablesInsert } from '../types.js';
import { actionHandlers } from './handlers/index.js';
import { ActionResult } from './types.js';
import { ExecutionLifecycleHooks } from './ExecutionLifecycleHooks.js';

/**
 * Creates and configures a default set of lifecycle hooks for logging automation runs.
 * This decouples the logging mechanism from the execution engine itself.
 */
export const createDefaultLoggingHooks = (automationId: string, contactId: string | null): ExecutionLifecycleHooks => {
    const hooks = new ExecutionLifecycleHooks();
    let runId: string | null = null;

    hooks.addHandler('workflowExecuteBefore', async () => {
        const { data, error } = await supabaseAdmin.from('automation_runs').insert({
            automation_id: automationId,
            contact_id: contactId,
            status: 'running'
        } as any).select('id').single();

        if (error) {
            console.error(`[Execution Logging] Failed to create automation_run record for automation ${automationId}`, error);
            throw new Error('Failed to start execution log.');
        }
        if (!data) {
            throw new Error('Failed to retrieve automation run ID after creation.');
        }
        runId = data.id;
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

        // Log the node execution result
        const logPayload: TablesInsert<'automation_node_logs'> = {
            run_id: runId,
            node_id: node.id,
            status,
            details,
        };
        await supabaseAdmin.from('automation_node_logs').insert(logPayload as any);
        
        // Increment the success/error counter for the node
        await supabaseAdmin.rpc('increment_node_stat', {
            p_automation_id: automationId,
            p_node_id: node.id,
            p_status: status,
        });
    });

    return hooks;
};

/**
 * The core engine for executing an automation workflow.
 * This function is designed to be non-blocking (fire and forget).
 *
 * @param automation The automation object to execute.
 * @param contact The contact associated with this execution run.
 * @param startNodeId The ID of the node that triggered the execution.
 * @param triggerPayload The data payload from the trigger.
 * @param hooks An instance of ExecutionLifecycleHooks for logging and side effects.
 * @param profile The user's profile, containing API keys and other settings.
 */
export const executeAutomation = async (
    automation: Automation,
    contact: Contact | null,
    startNodeId: string,
    triggerPayload: Json | null,
    hooks: ExecutionLifecycleHooks,
    profile: Profile
): Promise<void> => {
    
    await hooks.runHook('workflowExecuteBefore');

    const nodesMap = new Map(automation.nodes.map(n => [n.id, n]));
    const edgesMap = new Map();
    automation.edges.forEach(edge => {
        if (!edgesMap.has(edge.source)) {
            edgesMap.set(edge.source, []);
        }
        edgesMap.get(edge.source).push(edge);
    });
    
    const executionQueue: { node: AutomationNode; contextContact: Contact | null }[] = [];
    let currentContactState = contact;

    // Start the execution with the trigger node itself.
    const startNode = nodesMap.get(startNodeId);
    if (startNode) {
        executionQueue.push({ node: startNode, contextContact: currentContactState });
    } else {
        const error = new Error(`Start node with ID ${startNodeId} not found in automation ${automation.id}.`);
        console.error(error.message);
        await hooks.runHook('workflowExecuteAfter', 'failed', error.message);
        return;
    }
    

    try {
        while (executionQueue.length > 0) {
            const { node, contextContact } = executionQueue.shift()!;
            await hooks.runHook('nodeExecuteBefore', node);

            const handler = actionHandlers[node.data.type];
            if (!handler) {
                throw new Error(`No action handler found for node type: ${node.data.type}`);
            }

            let result: ActionResult = {};
            let details = `Executing node '${node.data.label}'.`;
            let status: 'success' | 'failed' = 'success';

            try {
                result = await handler({ profile, contact: contextContact, trigger: triggerPayload, node });
                details = result.details || `Node '${node.data.label}' executed successfully.`;
                
                // Update contact state for the rest of the execution flow
                if (result.updatedContact) {
                    currentContactState = result.updatedContact;
                }
                
                const nextEdges = edgesMap.get(node.id) || [];
                
                if (result.nextNodeHandle) { // For logic nodes (condition, split)
                    const chosenEdge = nextEdges.find((e: any) => e.sourceHandle === result.nextNodeHandle);
                    if (chosenEdge) {
                        const nextNode = nodesMap.get(chosenEdge.target);
                        if (nextNode) {
                            executionQueue.push({ node: nextNode, contextContact: currentContactState });
                        }
                    }
                } else { // For action/trigger nodes
                    nextEdges.forEach((edge: any) => {
                        const nextNode = nodesMap.get(edge.target);
                        if (nextNode) {
                            executionQueue.push({ node: nextNode, contextContact: currentContactState });
                        }
                    });
                }
            } catch (e: any) {
                status = 'failed';
                details = e.message;
                console.error(`[Execution Engine] Error executing node ${node.id} (${node.data.label}):`, e);
                // Stop the execution path on failure
                await hooks.runHook('nodeExecuteAfter', node, status, details);
                throw e; // Propagate to the main catch block to fail the entire run
            }
            await hooks.runHook('nodeExecuteAfter', node, status, details);
        }

        await hooks.runHook('workflowExecuteAfter', 'success', 'Workflow completed successfully.');

    } catch (error: any) {
        console.error(`[Execution Engine] Workflow ${automation.id} failed.`, error);
        await hooks.runHook('workflowExecuteAfter', 'failed', error.message);
    }
};