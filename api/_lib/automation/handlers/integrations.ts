
import { ActionHandler } from '../types.js';
import { resolveJsonPlaceholders, resolveVariables } from '../helpers.js';

export const sendWebhook: ActionHandler = async ({ contact, node, trigger }) => {
    const config = (node.data.config || {}) as any;
    if (!config.url) {
        return { details: "Webhook não executado: URL não configurada." };
    }

    const context = { contact, trigger };
    const resolvedUrl = resolveVariables(config.url, context);
    const method = config.method || 'POST';
    const requestOptions: RequestInit = { method };

    const headers = new Headers();

    if (config.sendHeaders && Array.isArray(config.headers)) {
        config.headers.forEach((h: { key: string, value: string }) => {
            if (h.key) {
                headers.append(h.key, resolveVariables(h.value, context));
            }
        });
    }

    if (config.sendBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const bodyConfig = config.body || {};
        
        if (bodyConfig.contentType === 'json') {
            headers.set('Content-Type', 'application/json');
            if (bodyConfig.specify === 'raw') {
                requestOptions.body = resolveJsonPlaceholders(bodyConfig.rawJson || '{}', context);
            } else {
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
        throw new Error(`Falha ao enviar webhook para ${resolvedUrl}. Status: ${responseStatus}. Erro: ${e.message}`);
    }
};
