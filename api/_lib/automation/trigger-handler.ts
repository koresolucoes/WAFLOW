



import { supabaseAdmin } from '../supabaseAdmin.js';
import { executeAutomation } from '../engine.js';
import { Automation, Contact, Json } from '../types.js';

// Fetches all active automations for a user
const getActiveAutomations = async (userId: string): Promise<Automation[]> => {
    const { data, error } = await supabaseAdmin
        .from('automations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active');
    
    if (error) {
        console.error(`TriggerHandler Error: Failed to fetch automations for user ${userId}`, error);
        return [];
    }
    return (data as unknown as Automation[]) || [];
};

// Dispatches an automation to the engine without waiting for it to complete.
const dispatchAutomation = (automation: Automation, contact: Contact | null, startNodeId: string, trigger: Json | null) => {
    console.log(`Dispatching automation '${automation.name}' (ID: ${automation.id}) starting from node ${startNodeId}`);
    // Non-blocking call
    executeAutomation(automation, contact, startNodeId, trigger);
};

// Handles events related to incoming messages from Meta
export const handleMetaMessageEvent = async (userId: string, contact: Contact, message: any) => {
    const automations = await getActiveAutomations(userId);
    const messageBody = message.type === 'text' 
        ? message.text.body.toLowerCase() 
        : (message.type === 'interactive' && message.interactive.type === 'button_reply' ? message.interactive.button_reply.title.toLowerCase() : '');
    const buttonPayload = message.type === 'interactive' && message.interactive.type === 'button_reply' ? message.interactive.button_reply.id : undefined;

    const triggerData = { type: 'meta_message', payload: message };

    for (const auto of automations) {
        if (!auto.nodes) continue;
        
        for (const node of auto.nodes) {
            if (node.data.nodeType !== 'trigger') continue;

            const config = (node.data.config || {}) as any;
            let shouldTrigger = false;

            // Check for keyword trigger
            if (node.data.type === 'message_received_with_keyword' && config.keyword && messageBody.includes(config.keyword.toLowerCase())) {
                shouldTrigger = true;
            }
            // Check for button click trigger
            else if (node.data.type === 'button_clicked' && config.button_payload && buttonPayload === config.button_payload) {
                shouldTrigger = true;
            }
            
            if (shouldTrigger) {
                dispatchAutomation(auto, contact, node.id, triggerData);
            }
        }
    }
};

// Handles events for newly created contacts
export const handleNewContactEvent = async (userId: string, contact: Contact) => {
    const automations = await getActiveAutomations(userId);
    const triggerData = { type: 'new_contact', payload: { contact } };
    for (const auto of automations) {
        if (!auto.nodes) continue;
        const triggerNode = auto.nodes.find(n => n.data.nodeType === 'trigger' && n.data.type === 'new_contact');
        if (triggerNode) {
            dispatchAutomation(auto, contact, triggerNode.id, triggerData);
        }
    }
};

// Handles events when a specific tag is added to a contact
export const handleTagAddedEvent = async (userId: string, contact: Contact, addedTag: string) => {
    const automations = await getActiveAutomations(userId);
    const triggerData = { type: 'tag_added', payload: { contact, addedTag } };

    for (const auto of automations) {
        if (!auto.nodes) continue;
        
        for (const triggerNode of auto.nodes) {
            if (triggerNode.data.nodeType !== 'trigger' || triggerNode.data.type !== 'new_contact_with_tag') continue;
            
            const config = (triggerNode.data.config || {}) as any;
            if (config?.tag?.toLowerCase() === addedTag.toLowerCase()) {
                dispatchAutomation(auto, contact, triggerNode.id, triggerData);
            }
        }
    }
};
