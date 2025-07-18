

import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendTemplatedMessage, sendTextMessage, sendMediaMessage, sendInteractiveMessage } from '../meta/messages.js';
import { AutomationNode, Contact, Json, MetaConfig, MessageTemplate, Profile, TablesUpdate } from '../types.js';
import { handleTagAddedEvent } from './trigger-handler.js';

// ====================================================================================
// Helper Functions
// ====================================================================================

const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

const resolveVariables = (text: string, context: { contact: Contact | null, trigger: any }): string => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
        const trimmedPath = path.trim();
        const value = getValueFromPath(context, trimmedPath);
        
        // Handle array values (like tags) by joining them
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        
        return value !== undefined ? String(value) : `{{${trimmedPath}}}`;
    });
};

const resolveJsonPlaceholders = (jsonString: string, context: any): string => {
    if (typeof jsonString !== 'string') {
        return JSON.stringify(jsonString);
    }
    let processedJsonString = jsonString.replace(/"\{\{([^}]+)\}\}"/g, '{{$1}}');
    return processedJsonString.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
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
    contact: Contact | null;
    trigger: Json | null;
    node: AutomationNode;
}

export interface ActionResult {
    updatedContact?: Contact;
    nextNodeHandle?: 'yes' | 'no' | 'a' | 'b';
    details?: string;
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

const sendTemplate: ActionHandler = async ({ profile, contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Template" requer um contato. A automação foi iniciada por um gatilho que não fornece um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (!config.template_id) {
        throw new Error('Nenhum template foi selecionado nas configurações do nó.');
    }

    const { data: template, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', config.template_id).single();
    if (templateError || !template) throw new Error(`Erro ao buscar template: ${templateError?.message || 'Template não encontrado.'}`);
    
    const metaConfig = getMetaConfig(profile);
    const templateTyped = template as unknown as MessageTemplate;
    
    const finalComponents: any[] = [];
    const context = { contact, trigger };

    const resolvePlaceholder = (placeholder: string) => {
        const rawValue = placeholder === '{{1}}' ? '{{contact.name}}' : (config[placeholder] || '');
        return resolveVariables(rawValue, context);
    };

    // Process HEADER component
    const headerComponent = templateTyped.components.find(c => c.type === 'HEADER');
    if (headerComponent && headerComponent.text) {
        const placeholders = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
        if (placeholders.length > 0) {
            const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
            finalComponents.push({ type: 'header', parameters });
        }
    }

    // Process BODY component
    const bodyComponent = templateTyped.components.find(c => c.type === 'BODY');
    if (bodyComponent && bodyComponent.text) {
        const placeholders = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
        if (placeholders.length > 0) {
            const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
            finalComponents.push({ type: 'body', parameters });
        }
    }

    // Process BUTTONS component
    const buttonsComponent = templateTyped.components.find(c => c.type === 'BUTTONS');
    if (buttonsComponent && buttonsComponent.buttons) {
        buttonsComponent.buttons.forEach((button, index) => {
            if (button.type === 'URL' && button.url) {
                // The API expects a parameter for the dynamic part of the URL.
                // Example: URL is "https://acme.com/{{1}}". The placeholder is "{{1}}".
                // We resolve "{{1}}" to get the dynamic part, e.g., "product/1234".
                const placeholders = button.url.match(/\{\{\d+\}\}/g) || [];
                if (placeholders.length > 0) {
                    // Meta expects one parameter per variable in the URL button.
                    const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
                    
                    // Each button with variables needs its own component object.
                    finalComponents.push({
                        type: 'button',
                        sub_type: 'url',
                        index: String(index),
                        parameters: parameters
                    });
                }
            }
        });
    }

    await sendTemplatedMessage(
       metaConfig, 
       contact.phone, 
       templateTyped.template_name, 
       finalComponents.length > 0 ? finalComponents : undefined
    );

    return { details: `Template '${templateTyped.template_name}' enviado para ${contact.name}.` };
};

const sendTextMessageAction: ActionHandler = async ({ profile, contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Texto Simples" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (config.message_text) {
        const metaConfig = getMetaConfig(profile);
        const message = resolveVariables(config.message_text, { contact, trigger });
        await sendTextMessage(metaConfig, contact.phone, message);
        return { details: `Mensagem de texto enviada para ${contact.name}.` };
    }
    throw new Error('O texto da mensagem não está configurado.');
};

const sendMediaAction: ActionHandler = async ({ profile, contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Mídia" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if(config.media_url && config.media_type){
        const metaConfig = getMetaConfig(profile);
        const mediaUrl = resolveVariables(config.media_url, { contact, trigger });
        const caption = config.caption ? resolveVariables(config.caption, { contact, trigger }) : undefined;
        await sendMediaMessage(metaConfig, contact.phone, config.media_type, mediaUrl, caption);
        return { details: `Mídia (${config.media_type}) enviada para ${contact.name}.` };
    }
    throw new Error('URL da mídia ou tipo não estão configurados.');
};

const sendInteractiveMessageAction: ActionHandler = async ({ profile, contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Mensagem Interativa" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if(config.message_text && Array.isArray(config.buttons)){
         const metaConfig = getMetaConfig(profile);
         const message = resolveVariables(config.message_text, { contact, trigger });
         const buttons = config.buttons.map((b: any) => ({...b, text: resolveVariables(b.text, { contact, trigger })}));
         await sendInteractiveMessage(metaConfig, contact.phone, message, buttons);
         return { details: `Mensagem interativa enviada para ${contact.name}.` };
    }
    throw new Error('Texto da mensagem ou botões não configurados.');
};

const addTag: ActionHandler = async ({ contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Adicionar Tag" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (config.tag) {
        const tagToAdd = resolveVariables(config.tag, { contact, trigger });

        // Check if tag already exists to prevent re-triggering
        if (contact.tags?.includes(tagToAdd)) {
            return { updatedContact: contact, details: `Contato já possui a tag '${tagToAdd}'. Nenhuma ação executada.` };
        }

        const newTags = Array.from(new Set([...(contact.tags || []), tagToAdd]));
        const updatePayload: TablesUpdate<'contacts'> = { tags: newTags };
        const { data: updatedContact, error } = await supabaseAdmin
            .from('contacts')
            .update(updatePayload)
            .eq('id', contact.id)
            .select()
            .single();

        if (error) throw error;
        if (!updatedContact) throw new Error('Failed to update contact after adding tag.');
        const finalContact = updatedContact as any as Contact;

        // Non-blocking call to handle triggers for the newly added tag
        handleTagAddedEvent(contact.user_id, finalContact, tagToAdd);
        
        return { updatedContact: finalContact, details: `Tag '${tagToAdd}' adicionada ao contato.` };
    }
     throw new Error('Tag a ser adicionada não está configurada.');
};

const removeTag: ActionHandler = async ({ contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Remover Tag" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (config.tag) {
        const tagToRemove = resolveVariables(config.tag, { contact, trigger });
        const newTags = (contact.tags || []).filter(t => t !== tagToRemove);
        const updatePayload: TablesUpdate<'contacts'> = { tags: newTags };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload).eq('id', contact.id).select().single();
        if (error) throw error;
        if (!data) throw new Error('Failed to update contact after removing tag.');
        return { updatedContact: data as unknown as Contact, details: `Tag '${tagToRemove}' removida do contato.` };
    }
    throw new Error('Tag a ser removida não está configurada.');
};

const setCustomField: ActionHandler = async ({ contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Definir Campo Personalizado" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if(config.field_name){
        const fieldName = resolveVariables(config.field_name, { contact, trigger }).replace(/\s+/g, '_');
        const fieldValue = resolveVariables(config.field_value || '', { contact, trigger });
        const newCustomFields = { ...(contact.custom_fields as object || {}), [fieldName]: fieldValue };
        const updatePayload: TablesUpdate<'contacts'> = { custom_fields: newCustomFields };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload).eq('id', contact.id).select().single();
        if (error) throw error;
        if (!data) throw new Error('Failed to update contact after setting custom field.');
        return { updatedContact: data as unknown as Contact, details: `Campo '${fieldName}' atualizado para '${fieldValue}'.` };
    }
    throw new Error('Nome do campo personalizado não está configurado.');
};

const sendWebhook: ActionHandler = async ({ contact, node, trigger }) => {
    const config = (node.data.config || {}) as any;
    if (!config.url) {
        return { details: "Webhook não executado: URL não configurada." };
    }

    const context = { contact, trigger };
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
    
    let responseStatus = 0;
    try {
        const response = await fetch(resolvedUrl, requestOptions);
        responseStatus = response.status;
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
        }
         return { details: `Webhook enviado para ${resolvedUrl}. Resposta: ${response.status}` };
    } catch (e: any) {
        console.error(`Webhook execution failed for URL: ${resolvedUrl}`, e);
        // Do not throw, but log as an error in the automation details
        throw new Error(`Falha ao enviar webhook para ${resolvedUrl}. Status: ${responseStatus}. Erro: ${e.message}`);
    }
};

const condition: ActionHandler = async ({ contact, node, trigger }) => {
    const config = (node.data.config || {}) as any;
    const fieldPath = config.field ? config.field.replace(/\{\{|\}\}/g, '') : '';
    const operator = config.operator;
    const value = resolveVariables(config.value, { contact, trigger });
    
    const context = { contact, trigger };
    const sourceValue = getValueFromPath(context, fieldPath);

    let conditionMet = false;
    const lowerCaseValue = String(value).toLowerCase();
    
    // Check if sourceValue is an array (like tags)
    if (Array.isArray(sourceValue)) {
        const lowerCaseArray = sourceValue.map(v => String(v).toLowerCase());
        if (operator === 'contains') {
            conditionMet = lowerCaseArray.includes(lowerCaseValue);
        } else if (operator === 'not_contains') {
            conditionMet = !lowerCaseArray.includes(lowerCaseValue);
        } else if (operator === 'equals') {
            // For arrays, 'equals' might not be intuitive. We'll check if any element is an exact match.
             conditionMet = lowerCaseArray.includes(lowerCaseValue);
        }
    } else { // It's not an array
        const lowerCaseSourceValue = String(sourceValue ?? '').toLowerCase();
        if (operator === 'contains') {
            conditionMet = lowerCaseSourceValue.includes(lowerCaseValue);
        } else if (operator === 'not_contains') {
             conditionMet = !lowerCaseSourceValue.includes(lowerCaseValue);
        } else if (operator === 'equals') {
            conditionMet = lowerCaseSourceValue === lowerCaseValue;
        }
    }
    
    const details = `Condição avaliada: '${fieldPath}' (${sourceValue}) ${operator} '${value}'. Resultado: ${conditionMet ? 'Sim' : 'Não'}`;
    return { nextNodeHandle: conditionMet ? 'yes' : 'no', details };
};

const splitPath: ActionHandler = async () => {
    const path = Math.random() < 0.5 ? 'a' : 'b';
    return { nextNodeHandle: path, details: `Caminho dividido aleatoriamente para a Via ${path.toUpperCase()}.` };
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