
import { supabaseAdmin } from '../supabaseAdmin.js';
import { executeAutomation } from '../engine.js';
import { Automation, Contact, Json } from '../types.js';

type TriggerInfo = {
    automation_id: string;
    node_id: string;
};

// Dispatches automations found by a trigger lookup.
const dispatchAutomations = async (triggers: TriggerInfo[], contact: Contact | null, triggerPayload: Json | null) => {
    if (triggers.length === 0) return;

    // Deduplicate by automation ID to prevent running the same automation multiple times for the same event
    const uniqueAutomationIds = [...new Set(triggers.map(t => t.automation_id))];

    const { data: automations, error } = await supabaseAdmin
        .from('automations')
        .select('*')
        .in('id', uniqueAutomationIds);

    if (error) {
        console.error(`Trigger Dispatcher Error: Failed to fetch automations by IDs`, error);
        return;
    }
    
    const automationsMap = new Map((automations as unknown as Automation[]).map(a => [a.id, a]));

    for (const trigger of triggers) {
        const automation = automationsMap.get(trigger.automation_id);
        if (automation) {
            console.log(`Dispatching automation '${automation.name}' (ID: ${automation.id}) starting from node ${trigger.node_id}`);
            // Non-blocking call to the engine
            executeAutomation(automation, contact, trigger.node_id, triggerPayload);
        }
    }
};


// Handles events related to incoming messages from Meta
export const handleMetaMessageEvent = async (userId: string, contact: Contact, message: any) => {
    const messageBody = message.type === 'text' 
        ? message.text.body.toLowerCase() 
        : '';
    const buttonPayload = message.type === 'interactive' && message.interactive.type === 'button_reply' 
        ? message.interactive.button_reply.id 
        : undefined;

    const triggerLookups = [];

    // Lookup for keyword triggers
    if (messageBody) {
        triggerLookups.push(
            supabaseAdmin
                .from('automation_triggers')
                .select('automation_id, node_id')
                .eq('user_id', userId)
                .eq('trigger_type', 'message_received_with_keyword')
                .eq('trigger_key', messageBody)
        );
    }
    
    // Lookup for button click triggers
    if (buttonPayload) {
         triggerLookups.push(
            supabaseAdmin
                .from('automation_triggers')
                .select('automation_id, node_id')
                .eq('user_id', userId)
                .eq('trigger_type', 'button_clicked')
                .eq('trigger_key', buttonPayload)
        );
    }

    if (triggerLookups.length === 0) return;
    
    const results = await Promise.all(triggerLookups);
    const allTriggers: TriggerInfo[] = results.flatMap(res => res.data || []);
    
    if (allTriggers.length > 0) {
       const triggerData = { type: 'meta_message', payload: message };
       dispatchAutomations(allTriggers, contact, triggerData);
    }
};

// Handles events for newly created contacts
export const handleNewContactEvent = async (userId: string, contact: Contact) => {
    const { data: triggers, error } = await supabaseAdmin
        .from('automation_triggers')
        .select('automation_id, node_id')
        .eq('user_id', userId)
        .eq('trigger_type', 'new_contact');
        
    if (error) {
        console.error(`handleNewContactEvent Error:`, error);
        return;
    }

    if (triggers && triggers.length > 0) {
        const triggerData = { type: 'new_contact', payload: { contact } };
        dispatchAutomations(triggers, contact, triggerData);
    }
};

// Handles events when a specific tag is added to a contact
export const handleTagAddedEvent = async (userId: string, contact: Contact, addedTag: string) => {
    const { data: triggers, error } = await supabaseAdmin
        .from('automation_triggers')
        .select('automation_id, node_id')
        .eq('user_id', userId)
        .eq('trigger_type', 'new_contact_with_tag')
        .eq('trigger_key', addedTag.toLowerCase());
        
    if (error) {
        console.error(`handleTagAddedEvent Error:`, error);
        return;
    }
    
    if (triggers && triggers.length > 0) {
        const triggerData = { type: 'tag_added', payload: { contact, addedTag } };
        dispatchAutomations(triggers, contact, triggerData);
    }
};
