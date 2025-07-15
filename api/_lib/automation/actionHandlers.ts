
import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendTemplatedMessage, sendTextMessage, sendMediaMessage, sendInteractiveMessage } from '../meta/messages.js';
import { AutomationNode, Contact, Json, MetaConfig, MessageTemplate, Profile, TablesUpdate } from '../types.js';

// ====================================================================================
// Helper Functions
// ====================================================================================

const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

const resolveVariables = (text: string, context: { contact: Contact, triggerData: any }): string => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getValueFromPath(context, path.trim());
        return value !== undefined ? String(value) : match;
    });
};

const resolveJsonPlaceholders = (jsonString: string, context: any): string => {
    if (typeof jsonString !== 'string') {
        return JSON.stringify(jsonString);
    }
    let processedJsonString = jsonString.replace(/"\{\{([^}]+)\}\}"/g, '{{$1}}');
    return processedJsonString.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getValueFromPath(context, path.trim());
        if (value === undefined || value === null) {
            return 'null';
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return JSON.stringify(value);
    });
};

// ====================================================================================
// Types & Interfaces
// ====================================================================================

export interface ActionContext {
    profile: Profile;
    contact: Contact;
    triggerData: Json | null;
    node: AutomationNode;
}

interface ActionResult {
    updatedContact?: Contact;
    nextNodeHandle?: 'yes' | 'no' | 'a' | 'b';
}

type ActionHandler = (context: ActionContext) => Promise<ActionResult>;

// ====================================================================================
// Action Handler Implementations
// ====================================================================================

const sendTemplate: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    const { data: template, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', config.template_id).single();
    if (templateError) throw templateError;
    if (template) {
         const templateTyped = template as unknown as MessageTemplate;
         
         let allText = '';
         templateTyped.components.forEach(c => {
             if(c.text) allText += c.text + ' ';
             if(c.type === 'BUTTONS' && c.buttons) {
                 c.buttons.forEach(b => {
                     if(b.type === 'URL' && b.url) allText += b.url + ' ';
                 });
             }
         });
         const placeholders = allText.match(/\{\{\d+\}\}/g) || [];
         const uniquePlaceholders = [...new Set(placeholders)];
         
         const bodyParameters = uniquePlaceholders.map(p => {
            const rawValue = p === '{{1}}' ? '{{contact.name}}' : (config[p] || '');
            const resolvedValue = resolveVariables(rawValue, { contact, triggerData });
            return { type: 'text', text: resolvedValue };
         });

         const components = [{ type: 'body', parameters: bodyParameters }];

        await sendTemplatedMessage(
            profile as unknown as MetaConfig, 
            contact.phone, 
            templateTyped.template_name, 
            components
        );
    }
    return {};
};

const sendTextMessageAction: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if (config.message_text) {
        const message = resolveVariables(config.message_text, { contact, triggerData });
        await sendTextMessage(profile as unknown as MetaConfig, contact.phone, message);
    }
    return {};
};

const sendMediaAction: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if(config.media_url && config.media_type){
        const mediaUrl = resolveVariables(config.media_url, { contact, triggerData });
        const caption = config.caption ? resolveVariables(config.caption, { contact, triggerData }) : undefined;
        await sendMediaMessage(profile as unknown as MetaConfig, contact.phone, config.media_type, mediaUrl, caption);
    }
    return {};
};

const sendInteractiveMessageAction: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if(config.message_text && Array.isArray(config.buttons)){
         const message = resolveVariables(config.message_text, { contact, triggerData });
         const buttons = config.buttons.map((b: any) => ({...b, text: resolveVariables(b.text, { contact, triggerData })}));
         await sendInteractiveMessage(profile as unknown as MetaConfig, contact.phone, message, buttons);
    }
    return {};
};

const addTag: ActionHandler = async ({ contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if (config.tag) {
        const tagToAdd = resolveVariables(config.tag, { contact, triggerData });
        const newTags = Array.from(new Set([...(contact.tags || []), tagToAdd]));
        const updatePayload: TablesUpdate<'contacts'> = { tags: newTags };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload).eq('id', contact.id).select().single();
        if (error) throw error;
        if (data) return { updatedContact: data as unknown as Contact };
    }
    return {};
};

const removeTag: ActionHandler = async ({ contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if (config.tag) {
        const tagToRemove = resolveVariables(config.tag, { contact, triggerData });
        const newTags = (contact.tags || []).filter(t => t !== tagToRemove);
        const updatePayload: TablesUpdate<'contacts'> = { tags: newTags };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload).eq('id', contact.id).select().single();
        if (error) throw error;
        if (data) return { updatedContact: data as unknown as Contact };
    }
    return {};
};

const setCustomField: ActionHandler = async ({ contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if(config.field_name){
        const fieldName = resolveVariables(config.field_name, { contact, triggerData });
        const fieldValue = resolveVariables(config.field_value || '', { contact, triggerData });
        const newCustomFields = { ...(contact.custom_fields as object || {}), [fieldName]: fieldValue };
        const updatePayload: TablesUpdate<'contacts'> = { custom_fields: newCustomFields };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload).eq('id', contact.id).select().single();
        if (error) throw error;
        if (data) return { updatedContact: data as unknown as Contact };
    }
    return {};
};

const sendWebhook: ActionHandler = async ({ contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if (config.url) {
        const url = resolveVariables(config.url, { contact, triggerData });
        const method = config.method || 'POST';
        const headers = { 'Content-Type': 'application/json' };
        const requestOptions: RequestInit = { method, headers };

        if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && config.body) {
            const jsonBodyString = resolveJsonPlaceholders(config.body, { contact, triggerData });
            try {
                JSON.parse(jsonBodyString);
                requestOptions.body = jsonBodyString;
            } catch (e) {
               console.error("Webhook Body Error: Final JSON is invalid after resolving variables.", { body: jsonBodyString, error: e });
               throw new Error("O corpo do Webhook resultou em um JSON inválido. Verifique a sintaxe e se os placeholders (ex: {{contact.name}}) estão sem aspas ao redor.");
            }
        }
        
        await fetch(url, requestOptions);
    }
    return {};
};

const condition: ActionHandler = async ({ contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    const fieldPath = config.field || '';
    const operator = config.operator;
    const value = resolveVariables(config.value, { contact, triggerData });
    
    // Determine the source object based on the prefix of the field path.
    const sourceObject = fieldPath.startsWith('trigger.') ? triggerData : contact;
    // Remove prefix for lookup if it exists.
    const cleanFieldPath = fieldPath.startsWith('trigger.') ? fieldPath.substring(8) : fieldPath;
    const sourceValue = getValueFromPath(sourceObject, cleanFieldPath);

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
    
    return { nextNodeHandle: conditionMet ? 'yes' : 'no' };
};

const splitPath: ActionHandler = async () => {
    return { nextNodeHandle: Math.random() < 0.5 ? 'a' : 'b' };
};


// ====================================================================================
// Action Handler Map
// ====================================================================================

export const actionHandlers: Record<string, ActionHandler> = {
    'send_template': sendTemplate,
    'send_text_message': sendTextMessageAction,
    'send_media': sendMediaAction,
    'send_interactive_message': sendInteractiveMessageAction,
    'add_tag': addTag,
    'remove_tag': removeTag,
    'set_custom_field': setCustomField,
    'send_webhook': sendWebhook,
    'condition': condition,
    'split_path': splitPath,
    // Triggers don't have actions, so they are not included here.
};
