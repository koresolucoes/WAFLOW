

import { supabaseAdmin } from '../supabaseAdmin.js';
import { executeAutomation, createDefaultLoggingHooks } from './engine.js';
import { Automation, Contact, Json, Profile } from '../types.js';
import { sanitizeAutomation } from './utils.js';

type TriggerInfo = {
    automation_id: string;
    node_id: string;
};

// Dispatches automations found by a trigger lookup.
const dispatchAutomations = async (userId: string, triggers: TriggerInfo[], contact: Contact | null, triggerPayload: Json | null) => {
    if (triggers.length === 0) return;

    // Fetch the user's profile which contains necessary configs (like Meta tokens)
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (profileError || !profile) {
        console.error(`Trigger Dispatcher Error: Could not find profile for user ${userId}.`, profileError);
        return;
    }

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

    const executionPromises = triggers.map(trigger => {
        const rawAutomation = automationsMap.get(trigger.automation_id);
        if (rawAutomation) {
            const automation = sanitizeAutomation(rawAutomation);
            console.log(`Dispatching automation '${automation.name}' (ID: ${automation.id}) starting from node ${trigger.node_id}`);
            const hooks = createDefaultLoggingHooks(automation.id, contact ? contact.id : null);
            // Return the promise from executeAutomation
            return executeAutomation(automation, contact, trigger.node_id, triggerPayload, hooks, profile as Profile);
        }
        return Promise.resolve(); // Return a resolved promise for triggers without a matching automation
    });

    await Promise.all(executionPromises);
};

// Handles events related to incoming messages from Meta
const handleMetaMessageEvent = async (userId: string, contact: Contact, message: any) => {
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
    const allTriggers: TriggerInfo[] = results.flatMap(res => res.error ? [] : (res.data || []));
    
    if (allTriggers.length > 0) {
       const triggerData = { type: 'meta_message', payload: message };
       await dispatchAutomations(userId, allTriggers, contact, triggerData);
    }
};

// Handles events for newly created contacts
const handleNewContactEvent = async (userId: string, contact: Contact) => {
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
        await dispatchAutomations(userId, triggers as TriggerInfo[], contact, triggerData);
    }
};

// Handles events when a specific tag is added to a contact
export const handleTagAddedEvent = async (userId: string, contact: Contact, addedTag: string) => {
    const { data: triggers, error } = await supabaseAdmin
        .from('automation_triggers')
        .select('automation_id, node_id')
        .eq('user_id', userId)
        .eq('trigger_type', 'tag_added')
        .ilike('trigger_key', addedTag);
        
    if (error) {
        console.error(`handleTagAddedEvent Error:`, error);
        return;
    }
    
    if (triggers && triggers.length > 0) {
        const triggerData = { type: 'tag_added', payload: { contact, addedTag } };
        await dispatchAutomations(userId, triggers as TriggerInfo[], contact, triggerData);
    }
};

/**
 * The central event bus for the application. All business events that can trigger automations
 * should be published through this function. It ensures a decoupled architecture where
 * event sources (like webhooks or API calls) don't need to know about the automation engine.
 * @param eventType A string identifying the business event (e.g., 'contact_created').
 * @param userId The ID of the user who owns the event.
 * @param data The payload associated with the event.
 */
export const publishEvent = async (eventType: string, userId: string, data: any) => {
    console.log(`Publishing event: ${eventType} for user ${userId}`);
    try {
        switch (eventType) {
            case 'message_received':
                // data = { contact, message }
                await handleMetaMessageEvent(userId, data.contact, data.message);
                break;
            case 'contact_created':
                // data = { contact }
                await handleNewContactEvent(userId, data.contact);
                break;
            case 'tag_added':
                // data = { contact, tag }
                await handleTagAddedEvent(userId, data.contact, data.tag);
                break;
            default:
                console.warn(`Unknown event type published: ${eventType}`);
        }
    } catch (error) {
        console.error(`Error processing event ${eventType}:`, error);
        // Do not re-throw, to avoid crashing the caller (like a webhook response)
    }
};