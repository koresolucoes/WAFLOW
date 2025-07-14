
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { sendTemplatedMessage } from '../../services/meta/messages';
import { Automation, Contact, Json, MetaConfig, NodeData } from '../../types';

// Helper to resolve nested values from an object path (e.g., 'contact.custom_fields.order_id')
const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

// Replaces placeholders like {{contact.name}} with actual data
const resolveVariables = (text: string, context: { contact: Contact, trigger: any }): string => {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getValueFromPath(context, path.trim());
        return value !== undefined ? String(value) : match;
    });
};

// Main function to execute an automation flow
export const executeAutomation = async (
    automation: Automation,
    contact: Contact,
    startNodeId: string,
    triggerData: Json | null = null
) => {
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', automation.user_id)
        .single();
    if (profileError || !profile) {
        console.error(`Automation Engine: Could not find profile for user ${automation.user_id}`);
        return;
    }

    const { data: run, error: runError } = await supabaseAdmin.from('automation_runs').insert({
        automation_id: automation.id,
        contact_id: contact.id,
        status: 'running',
    }).select().single();
    if (runError) {
        console.error(`Automation Engine: Failed to create run log for automation ${automation.id}`, runError);
        return;
    }

    const context = { contact, trigger: triggerData };
    const nodeQueue: { nodeId: string, sourceHandle?: string }[] = [{ nodeId: startNodeId }];
    const processedNodes = new Set<string>();

    const metaConfig: MetaConfig = {
        accessToken: profile.meta_access_token || '',
        wabaId: profile.meta_waba_id || '',
        phoneNumberId: profile.meta_phone_number_id || ''
    };

    while (nodeQueue.length > 0) {
        const { nodeId } = nodeQueue.shift()!;
        if (processedNodes.has(nodeId)) continue; // Avoid loops
        processedNodes.add(nodeId);

        const node = automation.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        try {
            switch (node.data.type as NodeData['type']) {
                case 'send_template':
                    // Logic to send a Meta template
                    // This part needs to be fully implemented based on how variables are passed
                    break;
                case 'add_tag':
                    const tagToAdd = resolveVariables((node.data.config as any)?.tag, context);
                    if (tagToAdd) {
                        const newTags = Array.from(new Set([...(contact.tags || []), tagToAdd]));
                        const { data, error } = await supabaseAdmin.from('contacts').update({ tags: newTags }).eq('id', contact.id).select().single();
                        if (!error && data) contact = data as Contact;
                    }
                    break;
                case 'remove_tag':
                    const tagToRemove = resolveVariables((node.data.config as any)?.tag, context);
                     if (tagToRemove) {
                        const newTags = (contact.tags || []).filter(t => t !== tagToRemove);
                        const { data, error } = await supabaseAdmin.from('contacts').update({ tags: newTags }).eq('id', contact.id).select().single();
                        if (!error && data) contact = data as Contact;
                    }
                    break;
                case 'condition':
                     // Simplified condition logic
                    const field = (node.data.config as any)?.field;
                    const operator = (node.data.config as any)?.operator;
                    const value = resolveVariables((node.data.config as any)?.value, context);
                    let conditionMet = false;
                    
                    if (field === 'tags' && operator === 'contains') {
                       conditionMet = contact.tags?.includes(value) ?? false;
                    }
                    // Add more condition checks here...
                    
                    const handleId = conditionMet ? 'yes' : 'no';
                    const nextEdge = automation.edges.find(e => e.source === nodeId && e.sourceHandle === handleId);
                    if (nextEdge) nodeQueue.push({ nodeId: nextEdge.target });
                    continue; // Skip default edge handling
                // Add more cases for other actions (send_text_message, etc.)
            }

            // Find next node(s) in the flow
            const outgoingEdges = automation.edges.filter(e => e.source === nodeId);
            for (const edge of outgoingEdges) {
                nodeQueue.push({ nodeId: edge.target });
            }
        } catch (err: any) {
            console.error(`Error processing node ${nodeId} in automation ${automation.id}:`, err);
            await supabaseAdmin.from('automation_runs').update({ status: 'failed', details: err.message }).eq('id', run.id);
            return; // Stop execution on error
        }
    }

    await supabaseAdmin.from('automation_runs').update({ status: 'success' }).eq('id', run.id);
};
