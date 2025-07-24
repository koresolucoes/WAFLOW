
import { supabaseAdmin } from '../../supabaseAdmin';
import { sendTemplatedMessage, sendTextMessage, sendMediaMessage, sendInteractiveMessage } from '../../meta/messages';
import { MessageTemplate } from '../../types';
import { ActionHandler } from '../types';
import { getMetaConfig, resolveVariables } from '../helpers';

export const sendTemplate: ActionHandler = async ({ profile, contact, node, trigger }) => {
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

    await sendTemplatedMessage(
       metaConfig, 
       contact.phone, 
       templateTyped.template_name, 
       finalComponents.length > 0 ? finalComponents : undefined
    );

    return { details: `Template '${templateTyped.template_name}' enviado para ${contact.name}.` };
};

export const sendTextMessageAction: ActionHandler = async ({ profile, contact, node, trigger }) => {
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

export const sendMediaAction: ActionHandler = async ({ profile, contact, node, trigger }) => {
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

export const sendInteractiveMessageAction: ActionHandler = async ({ profile, contact, node, trigger }) => {
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
