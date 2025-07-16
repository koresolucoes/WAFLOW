
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

const getMetaConfig = (profile: Profile): MetaConfig => {
    const metaConfig = {
        accessToken: profile.meta_access_token || '',
        wabaId: profile.meta_waba_id || '',
        phoneNumberId: profile.meta_phone_number_id || '',
    };
    if (!metaConfig.accessToken || !metaConfig.wabaId || !metaConfig.phoneNumberId) {
        throw new Error(`Meta configuration missing in profile for user ${profile.id}`);
    }
    return metaConfig;
};

// ====================================================================================
// Action Handler Implementations
// ====================================================================================

const sendTemplate: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    const { data: template, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', config.template_id).single();
    if (templateError) throw templateError;
    if (template) {
         const metaConfig = getMetaConfig(profile);
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
            metaConfig, 
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
        const metaConfig = getMetaConfig(profile);
        const message = resolveVariables(config.message_text, { contact, triggerData });
        await sendTextMessage(metaConfig, contact.phone, message);
    }
    return {};
};

const sendMediaAction: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if(config.media_url && config.media_type){
        const metaConfig = getMetaConfig(profile);
        const mediaUrl = resolveVariables(config.media_url, { contact, triggerData });
        const caption = config.caption ? resolveVariables(config.caption, { contact, triggerData }) : undefined;
        await sendMediaMessage(metaConfig, contact.phone, config.media_type, mediaUrl, caption);
    }
    return {};
};

const sendInteractiveMessageAction: ActionHandler = async ({ profile, contact, node, triggerData }) => {
    const config = (node.data.config || {}) as any;
    if(config.message_text && Array.isArray(config.buttons)){
         const metaConfig = getMetaConfig(profile);
         const message = resolveVariables(config.message_text, { contact, triggerData });
         const buttons = config.buttons.map((b: any) => ({...b, text: resolveVariables(b.text, { contact, triggerData })}));
         await sendInteractiveMessage(metaConfig, contact.phone, message, buttons);
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
    if (!config.url) return {}; // No URL, do nothing

    const context = { contact, triggerData };
    const resolvedUrl = resolveVariables(config.url, context);
    const method = config.method || 'POST';
    const requestOptions: RequestInit = { method };

    const headers = new Headers();

    // Build Headers
    if (config.sendHeaders && Array.isArray(config.headers)) {
        config.headers.forEach((h: { key: string, value: string }) => {
            if (h.key) {
                headers.append(h.key, resolveVariables(h.value, context));
            }
        });
    }

    // Build Body and set Content-Type
    if (config.sendBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const bodyConfig = config.body || {};
        
        if (bodyConfig.contentType === 'json') {
            headers.set('Content-Type', 'application/json');
            if (bodyConfig.specify === 'raw') {
                requestOptions.body = resolveJsonPlaceholders(bodyConfig.rawJson || '{}', context);
            } else { // fields
                const bodyObject = (bodyConfig.params || []).reduce((acc: any, p: { key: string, value: string }) => {
                    if (p.key) acc[p.key] = resolveVariables(p.value, context);
                    return acc;
                }, {});
                requestOptions.body = JSON.stringify(bodyObject);
            }
        } else if (bodyConfig.contentType === 'form_urlencoded') {
            headers.set('Content-Type', 'application/x-www-form-urlencoded');
            const formParams = new URLSearchParams();
            (bodyConfig.params || []).forEach((p: { key: string, value: string }) => {
                if(p.key) formParams.append(p.key, resolveVariables(p.value, context));
            });
            requestOptions.body = formParams.toString();
        }
    }

    requestOptions.headers = headers;

    try {
        await fetch(resolvedUrl, requestOptions);
    } catch (e: any) {
        console.error(`Webhook execution failed for URL: ${resolvedUrl}`, e);
        // Do not throw to avoid stopping the entire automation run for a single failed webhook
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
