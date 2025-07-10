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
 * @param components - Array de componentes para substituir variáveis no template.
 * @returns A resposta da API da Meta.
 */
export const sendTemplatedMessage = async (
    config: MetaConfig,
    to: string,
    templateName: string,
    components?: any[]
): Promise<SendMessageResponse> => {
    if (!config.phoneNumberId) throw new Error("ID do Número de Telefone não configurado.");

    // Remove caracteres não numéricos do telefone
    const sanitizedPhone = to.replace(/\D/g, '');

    const payload: MetaMessagePayload = {
        messaging_product: 'whatsapp',
        to: sanitizedPhone,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: 'pt_BR'
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
