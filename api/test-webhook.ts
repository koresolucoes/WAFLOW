
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveJsonPlaceholders, resolveVariables } from './_lib/automation/helpers.js';


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { webhookConfig, context } = req.body;

        if (!webhookConfig || !context) {
            return res.status(400).json({ error: 'Missing webhookConfig or context in request body' });
        }

        const url = resolveVariables(webhookConfig.url || '', context);
        if (!url) {
            return res.status(400).json({ error: 'URL é obrigatória e não pôde ser resolvida.' });
        }
        
        const method = webhookConfig.method || 'POST';
        const requestOptions: RequestInit = { method };
        const headers = new Headers();

        // Build Headers
        if (webhookConfig.sendHeaders && Array.isArray(webhookConfig.headers)) {
            webhookConfig.headers.forEach((h: { key: string, value: string }) => {
                if (h.key) {
                    headers.append(h.key, resolveVariables(h.value, context));
                }
            });
        }

        // Build Body and set Content-Type
        if (webhookConfig.sendBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
            const bodyConfig = webhookConfig.body || {};
            
            if (bodyConfig.contentType === 'json') {
                headers.set('Content-Type', 'application/json');
                if (bodyConfig.specify === 'raw') {
                    try {
                        const resolvedBody = resolveJsonPlaceholders(bodyConfig.rawJson || '{}', context);
                        JSON.parse(resolvedBody); // Validate
                        requestOptions.body = resolvedBody;
                    } catch (e: any) {
                        return res.status(400).json({ error: 'Corpo JSON Bruto inválido após resolver variáveis.', details: e.message });
                    }
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
                    if (p.key) formParams.append(p.key, resolveVariables(p.value, context));
                });
                requestOptions.body = formParams.toString();
            }
        }
        
        requestOptions.headers = headers;

        const externalRes = await fetch(url, requestOptions);

        const responseBody = await externalRes.text();
        let bodyAsJson: any;
        try {
            bodyAsJson = JSON.parse(responseBody);
        } catch {
            bodyAsJson = responseBody;
        }

        res.status(200).json({
            status: externalRes.status,
            statusText: externalRes.statusText,
            headers: Object.fromEntries(externalRes.headers.entries()),
            body: bodyAsJson
        });

    } catch (err: any) {
        console.error('Error in test-webhook function:', err);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.', details: err.message });
    }
}
