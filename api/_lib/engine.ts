


import { supabaseAdmin } from './supabaseAdmin.js';
import { sendTemplatedMessage, sendTextMessage, sendMediaMessage, sendInteractiveMessage } from './meta/messages.js';
import { Automation, Contact, Json, MetaConfig, NodeData, MessageTemplate } from './types.js';

// Helper to resolve nested values from an object path (e.g., 'contact.custom_fields.order_id')
const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

// Replaces placeholders like {{contact.name}} or {{trigger.some_data}} with actual data
const resolveVariables = (text: string, context: { contact: Contact, trigger: any }): string => {
    if (typeof text !== 'string') return text;
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
        console.error(`Engine Error: Could not find profile for user ${automation.user_id}`);
        return;
    }

    const { data: run, error: runError } = await supabaseAdmin.from('automation_runs').insert({
        automation_id: automation.id,
        contact_id: contact.id,
        status: 'running',
        details: `Started from node ${startNodeId}`
    }).select().single();

    if (runError) {
        console.error(`Engine Error: Failed to create run log for automation ${automation.id}`, runError);
        return;
    }

    let currentContactState = { ...contact };
    const context = { contact: currentContactState, trigger: triggerData };

    const nodeQueue: { nodeId: string }[] = [{ nodeId: startNodeId }];
    const processedNodes = new Set<string>();

    const metaConfig: MetaConfig = {
        accessToken: profile.meta_access_token || '',
        wabaId: profile.meta_waba_id || '',
        phoneNumberId: profile.meta_phone_number_id || ''
    };

    while (nodeQueue.length > 0) {
        const { nodeId } = nodeQueue.shift()!;
        if (processedNodes.has(nodeId)) continue; // Avoid infinite loops

        const node = automation.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        processedNodes.add(nodeId); // Mark as processed for this run

        let nextNodeHandle: string | undefined = undefined;

        try {
            const config = (node.data.config || {}) as any;

            switch (node.data.type as NodeData['type']) {
                case 'send_template':
                    const { data: template } = await supabaseAdmin.from('message_templates').select('*').eq('id', config.template_id).single();
                    if (template) {
                         const templateTyped = template as unknown as MessageTemplate;
                         const textForVars = (templateTyped.components as any[])?.reduce((acc, c) => acc + (c.text || ''), '') || '';
                         const placeholders = textForVars.match(/\{\{\d+\}\}/g) || [];
                         const uniquePlaceholders = [...new Set(placeholders)];
                         
                         const bodyParameters = uniquePlaceholders.map(p => {
                            const textValue = p === '{{1}}' ? currentContactState.name : resolveVariables(p, context);
                            return { type: 'text', text: textValue || '' };
                         });

                         const components = [{
                            type: 'body',
                            parameters: bodyParameters
                         }];

                        await sendTemplatedMessage(metaConfig, currentContactState.phone, templateTyped.template_name, components);
                    }
                    break;
                case 'send_text_message':
                    if (config.message_text) {
                        const message = resolveVariables(config.message_text, context);
                        await sendTextMessage(metaConfig, currentContactState.phone, message);
                    }
                    break;
                case 'send_media':
                    if(config.media_url && config.media_type){
                        const mediaUrl = resolveVariables(config.media_url, context);
                        const caption = config.caption ? resolveVariables(config.caption, context) : undefined;
                        await sendMediaMessage(metaConfig, currentContactState.phone, config.media_type, mediaUrl, caption);
                    }
                    break;
                case 'send_interactive_message':
                    if(config.message_text && Array.isArray(config.buttons)){
                         const message = resolveVariables(config.message_text, context);
                         const buttons = config.buttons.map((b: any) => ({...b, text: resolveVariables(b.text, context)}));
                         await sendInteractiveMessage(metaConfig, currentContactState.phone, message, buttons);
                    }
                    break;
                case 'add_tag':
                    if (config.tag) {
                        const tagToAdd = resolveVariables(config.tag, context);
                        const newTags = Array.from(new Set([...(currentContactState.tags || []), tagToAdd]));
                        const { data } = await supabaseAdmin.from('contacts').update({ tags: newTags }).eq('id', currentContactState.id).select().single();
                        if (data) currentContactState = data as Contact;
                    }
                    break;
                case 'remove_tag':
                    if (config.tag) {
                        const tagToRemove = resolveVariables(config.tag, context);
                        const newTags = (currentContactState.tags || []).filter(t => t !== tagToRemove);
                        const { data } = await supabaseAdmin.from('contacts').update({ tags: newTags }).eq('id', currentContactState.id).select().single();
                        if (data) currentContactState = data as Contact;
                    }
                    break;
                case 'set_custom_field':
                    if(config.field_name){
                        const fieldName = resolveVariables(config.field_name, context);
                        const fieldValue = resolveVariables(config.field_value || '', context);
                        const newCustomFields = { ...(currentContactState.custom_fields as object || {}), [fieldName]: fieldValue };
                        const { data } = await supabaseAdmin.from('contacts').update({ custom_fields: newCustomFields }).eq('id', currentContactState.id).select().single();
                        if (data) currentContactState = data as Contact;
                    }
                    break;
                case 'condition':
                    const sourceType = config.source_type || 'contact'; // default to contact
                    const fieldPath = config.field || '';
                    const operator = config.operator;
                    const value = resolveVariables(config.value, context);
                    
                    const sourceObject = sourceType === 'trigger' ? context.trigger : context.contact;
                    const sourceValue = getValueFromPath(sourceObject, fieldPath);

                    let conditionMet = false;
                    const lowerCaseValue = String(value).toLowerCase();
                    const lowerCaseSourceValue = String(sourceValue).toLowerCase();

                    if (operator === 'contains') {
                        conditionMet = Array.isArray(sourceValue) 
                            ? sourceValue.map(v => String(v).toLowerCase()).includes(lowerCaseValue)
                            : lowerCaseSourceValue.includes(lowerCaseValue);
                    } else if (operator === 'not_contains') {
                         conditionMet = Array.isArray(sourceValue) 
                            ? !sourceValue.map(v => String(v).toLowerCase()).includes(lowerCaseValue)
                            : !lowerCaseSourceValue.includes(lowerCaseValue);
                    } else if (operator === 'equals') {
                        conditionMet = lowerCaseSourceValue === lowerCaseValue;
                    }
                    
                    nextNodeHandle = conditionMet ? 'yes' : 'no';
                    break;
                case 'split_path':
                    nextNodeHandle = Math.random() < 0.5 ? 'a' : 'b';
                    break;

                case 'send_webhook':
                    if(config.url){
                        const url = resolveVariables(config.url, context);
                        const body = config.body ? JSON.parse(resolveVariables(config.body, context)) : {};
                        await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                    }
                    break;
            }

            // Find next node(s) in the flow
            const outgoingEdges = automation.edges.filter(e => e.source === nodeId && (!nextNodeHandle || e.sourceHandle === nextNodeHandle || !e.sourceHandle));
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