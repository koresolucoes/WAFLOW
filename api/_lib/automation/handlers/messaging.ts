import { supabaseAdmin } from '../../supabaseAdmin.js';
import { sendTemplatedMessage, sendTextMessage, sendMediaMessage, sendInteractiveMessage } from '../../meta/messages.js';
import { getMetaTemplateById } from '../../meta/templates.js';
import { MessageTemplate, MessageInsert } from '../../types.js';
import { ActionHandler } from '../types.js';
import { getMetaConfig, resolveVariables } from '../helpers.js';

const logSentMessage = async (payload: Omit<MessageInsert, 'team_id'>, teamId: string) => {
    const { error } = await supabaseAdmin.from('messages').insert({ ...payload, team_id: teamId } as any);
    if (error) {
        // Log the error but don't throw, as the message was already sent to Meta.
        // This prevents the automation from failing if only the DB logging fails.
        console.error(`[Message Logging] Failed to log sent message for contact ${payload.contact_id}:`, error);
    }
};

export const sendTemplate: ActionHandler = async ({ profile, contact, node, trigger, automationId, teamId }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Template" requer um contato. A automação foi iniciada por um gatilho que não fornece um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (!config.template_id) {
        throw new Error('Nenhum template foi selecionado nas configurações do nó.');
    }

    const { data: template, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', config.template_id).single();
    if (templateError) throw templateError;
    if (!template) throw new Error(`Template com ID ${config.template_id} não encontrado.`);
    
    if (!(template as any).meta_id) {
        throw new Error(`O template '${(template as any).template_name}' não está sincronizado com a Meta e não pode ser enviado.`);
    }
    
    const metaConfig = getMetaConfig(profile);
    const templateTyped = template as unknown as MessageTemplate;

    // Fetch template details from Meta to get correct name and language
    const metaTemplateDetails = await getMetaTemplateById(metaConfig, templateTyped.meta_id!);
    
    const finalComponents: any[] = [];
    const context = { contact, trigger };

    const resolvePlaceholder = (placeholder: string) => {
        const rawValue = placeholder === '{{1}}' ? '{{contact.name}}' : (config[placeholder] || '');
        return resolveVariables(rawValue, context);
    };

    const headerComponent = templateTyped.components.find(c => c.type === 'HEADER');
    if (headerComponent && headerComponent.text) {
        const placeholders = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
        if (placeholders.length > 0) {
            const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
            finalComponents.push({ type: 'header', parameters });
        }
    }

    const bodyComponent = templateTyped.components.find(c => c.type === 'BODY');
    if (bodyComponent && bodyComponent.text) {
        const placeholders = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
        if (placeholders.length > 0) {
            const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
            finalComponents.push({ type: 'body', parameters });
        }
    }

    const buttonsComponent = templateTyped.components.find(c => c.type === 'BUTTONS');
    if (buttonsComponent && buttonsComponent.buttons) {
        buttonsComponent.buttons.forEach((button, index) => {
            if (button.type === 'URL' && button.url) {
                const placeholders = button.url.match(/\{\{\d+\}\}/g) || [];
                if (placeholders.length > 0) {
                    const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
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

    const response = await sendTemplatedMessage(
       metaConfig, 
       contact.phone, 
       metaTemplateDetails.name,
       metaTemplateDetails.language,
       finalComponents.length > 0 ? finalComponents : undefined
    );
    
    const bodyText = bodyComponent?.text || 'Mensagem de template';
    let resolvedContent = bodyText;
    const placeholdersInBody = bodyText.match(/\{\{\d+\}\}/g) || [];
    for (const placeholder of placeholdersInBody) {
        resolvedContent = resolvedContent.replace(placeholder, resolvePlaceholder(placeholder));
    }

    await logSentMessage({
        contact_id: contact.id,
        automation_id: automationId,
        content: resolvedContent,
        meta_message_id: response.messages[0].id,
        status: 'sent',
        source: 'automation',
        type: 'outbound',
        sent_at: new Date().toISOString()
    }, teamId);


    return { details: `Template '${templateTyped.template_name}' enviado para ${contact.name}.` };
};

export const sendTextMessageAction: ActionHandler = async ({ profile, contact, node, trigger, automationId, teamId }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Texto Simples" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (config.message_text) {
        const metaConfig = getMetaConfig(profile);
        const message = resolveVariables(config.message_text, { contact, trigger });
        const response = await sendTextMessage(metaConfig, contact.phone, message);

        await logSentMessage({
            contact_id: contact.id,
            automation_id: automationId,
            content: message,
            meta_message_id: response.messages[0].id,
            status: 'sent',
            source: 'automation',
            type: 'outbound',
            sent_at: new Date().toISOString()
        }, teamId);

        return { details: `Mensagem de texto enviada para ${contact.name}.` };
    }
    throw new Error('O texto da mensagem não está configurado.');
};

export const sendMediaAction: ActionHandler = async ({ profile, contact, node, trigger, automationId, teamId }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Mídia" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if(config.media_url && config.media_type){
        const metaConfig = getMetaConfig(profile);
        const mediaUrl = resolveVariables(config.media_url, { contact, trigger });
        const caption = config.caption ? resolveVariables(config.caption, { contact, trigger }) : undefined;
        const response = await sendMediaMessage(metaConfig, contact.phone, config.media_type, mediaUrl, caption);

        await logSentMessage({
            contact_id: contact.id,
            automation_id: automationId,
            content: caption || `[Mídia: ${config.media_type}] ${mediaUrl}`,
            meta_message_id: response.messages[0].id,
            status: 'sent',
            source: 'automation',
            type: 'outbound',
            sent_at: new Date().toISOString()
        }, teamId);

        return { details: `Mídia (${config.media_type}) enviada para ${contact.name}.` };
    }
    throw new Error('URL da mídia ou tipo não estão configurados.');
};

export const sendInteractiveMessageAction: ActionHandler = async ({ profile, contact, node, trigger, automationId, teamId }) => {
    if (!contact) {
        throw new Error('Ação "Enviar Mensagem Interativa" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if(config.message_text && Array.isArray(config.buttons)){
         const metaConfig = getMetaConfig(profile);
         const message = resolveVariables(config.message_text, { contact, trigger });
         const buttons = config.buttons.map((b: any) => ({...b, text: resolveVariables(b.text, { contact, trigger })}));
         const response = await sendInteractiveMessage(metaConfig, contact.phone, message, buttons);

        await logSentMessage({
            contact_id: contact.id,
            automation_id: automationId,
            content: message,
            meta_message_id: response.messages[0].id,
            status: 'sent',
            source: 'automation',
            type: 'outbound',
            sent_at: new Date().toISOString()
        }, teamId);

         return { details: `Mensagem interativa enviada para ${contact.name}.` };
    }
    throw new Error('Texto da mensagem ou botões não configurados.');
};