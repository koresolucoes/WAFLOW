
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
    return (data as Automation[]) || [];
};

// Dispatches an automation to the engine without waiting for it to complete.
const dispatchAutomation = (automation: Automation, contact: Contact | null, startNodeId: string, triggerData: Json | null) => {
    console.log(`Dispatching automation '${automation.name}' (ID: ${automation.id}) starting from node ${startNodeId}`);
    // Non-blocking call
    executeAutomation(automation, contact, startNodeId, triggerData);
};

// Handles events related to incoming messages from Meta
export const handleMetaMessageEvent = async (userId: string, contact: Contact, message: any) => {
    const automations = await getActiveAutomations(userId);
    const messageBody = message.type === 'text' 
        ? message.text.body.toLowerCase() 
        : (message.type === 'interactive' && message.interactive.type === 'button_reply' ? message.interactive.button_reply.title.toLowerCase() : '');
    const buttonPayload = message.type === 'interactive' && message.interactive.type === 'button_reply' ? message.interactive.button_reply.id : undefined;

    for (const auto of automations) {
        if (!auto.nodes) continue;
        for (const node of auto.nodes) {
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
                dispatchAutomation(auto, contact, node.id, { message });
            }
        }
    }
};

// Handles events for newly created contacts
export const handleNewContactEvent = async (userId: string, contact: Contact) => {
    const automations = await getActiveAutomations(userId);
    for (const auto of automations) {
        if (!auto.nodes) continue;
        const triggerNode = auto.nodes.find(n => n.data.type === 'new_contact');
        if (triggerNode) {
            dispatchAutomation(auto, contact, triggerNode.id, { contact });
        }
    }
};

// Handles events when a specific tag is added to a contact
export const handleTagAddedEvent = async (userId: string, contact: Contact, addedTag: string) => {
    const automations = await getActiveAutomations(userId);
    for (const auto of automations) {
        if (!auto.nodes) continue;
        const triggerNode = auto.nodes.find(n => n.data.type === 'new_contact_with_tag' && (n.data.config as any)?.tag?.toLowerCase() === addedTag.toLowerCase());
        if (triggerNode) {
            dispatchAutomation(auto, contact, triggerNode.id, { contact, addedTag });
        }
    }
};
