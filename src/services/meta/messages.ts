

import { MetaConfig } from "../../types";
import metaApiClient from "./apiClient";
import { MetaMessagePayload } from "./types";

interface SendMessageResponse {
    messaging_product: 'whatsapp';
    contacts: { input: string; wa_id: string }[];
    messages: { id: string }[];
}


/**
 * Envia uma mensagem de template para um destinatário.
 * @param config - Configuração da API da Meta.
 * @param to - Número de telefone do destinatário no formato internacional (ex: 5511999998888).
 * @param templateName - O nome do template a ser enviado.
 * @param languageCode - O código de idioma do template (ex: 'pt_BR').
 * @param components - Array de componentes para substituir variáveis no template.
 * @returns A resposta da API da Meta.
 */
export const sendTemplatedMessage = async (
    config: MetaConfig,
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
): Promise<SendMessageResponse> => {
    if (!config.phoneNumberId) throw new Error("ID do Número de Telefone não configurado.");

    const sanitizedPhone = to.replace(/\D/g, '');

    const payload: MetaMessagePayload = {
        messaging_product: 'whatsapp',
        to: sanitizedPhone,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: languageCode
            },
            components,
        }
    };

    return metaApiClient<SendMessageResponse>(
        config,
        `/${config.phoneNumberId}/messages`,
        {
            method: 'POST',
            body: JSON.stringify(payload)
        }
    );
};

/**
 * Envia uma mensagem de texto simples.
 */
export const sendTextMessage = async (config: MetaConfig, to: string, text: string): Promise<SendMessageResponse> => {
    if (!config.phoneNumberId) throw new Error("ID do Número de Telefone não configurado.");
    const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { preview_url: true, body: text },
    };
    return metaApiClient<SendMessageResponse>(config, `/${config.phoneNumberId}/messages`, { method: 'POST', body: JSON.stringify(payload) });
};

/**
 * Envia uma mensagem de mídia (imagem, vídeo, documento) por URL.
 */
export const sendMediaMessage = async (config: MetaConfig, to: string, mediaType: 'image' | 'video' | 'document', url: string, caption?: string): Promise<SendMessageResponse> => {
    if (!config.phoneNumberId) throw new Error("ID do Número de Telefone não configurado.");
    const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: mediaType,
        [mediaType]: {
            link: url,
            ...(caption && { caption }),
        },
    };
    return metaApiClient<SendMessageResponse>(config, `/${config.phoneNumberId}/messages`, { method: 'POST', body: JSON.stringify(payload) });
};

/**
 * Envia uma mensagem interativa com botões de resposta rápida.
 */
export const sendInteractiveMessage = async (config: MetaConfig, to: string, bodyText: string, buttons: { id: string; text: string }[]): Promise<SendMessageResponse> => {
    if (!config.phoneNumberId) throw new Error("ID do Número de Telefone não configurado.");
    const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
                buttons: buttons.slice(0, 3).map(btn => ({
                    type: 'reply',
                    reply: { id: btn.id, title: btn.text },
                })),
            },
        },
    };
     return metaApiClient<SendMessageResponse>(config, `/${config.phoneNumberId}/messages`, { method: 'POST', body: JSON.stringify(payload) });
};