
import { MetaConfig } from "../types.js";
import metaApiClient from "./apiClient.js";
import { MetaMessagePayload, MetaTemplate } from "./types.js";

interface SendMessageResponse {
    messaging_product: 'whatsapp';
    contacts: { input: string; wa_id: string }[];
    messages: { id: string }[];
}

// Simple in-memory cache for template details to avoid redundant API calls.
const templateCache = new Map<string, { details: Pick<MetaTemplate, 'name' | 'language'>, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * Busca os detalhes de um template específico pelo seu ID da Meta.
 * @param config - Configuração da API da Meta.
 * @param templateId - O ID do template na plataforma da Meta (não o ID do banco de dados).
 * @returns Os detalhes do template, incluindo nome e idioma.
 */
export const getMetaTemplateById = async (config: MetaConfig, templateId: string): Promise<Pick<MetaTemplate, 'name' | 'language'>> => {
    // Check cache first
    const cached = templateCache.get(templateId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.details;
    }

    if (!templateId) throw new Error("O ID do template da Meta é necessário.");
    const response = await metaApiClient<{ name: string; language: string; }>(
        config,
        `/${templateId}?fields=name,language`
    );
    const details = { name: response.name, language: response.language };
    
    // Store in cache
    templateCache.set(templateId, { details, timestamp: Date.now() });

    return details;
};


/**
 * Envia uma mensagem de template para um destinatário.
 * @param config - Configuração da API da Meta.
 * @param to - Número de telefone do destinatário no formato internacional (ex: 5511999998888).
 * @param templateName - O nome do template a ser enviado.
 * @param languageCode - O código do idioma do template (ex: 'pt_BR')
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
