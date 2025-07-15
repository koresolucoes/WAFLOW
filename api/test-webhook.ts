
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper to resolve nested values from an object path (e.g., 'contact.custom_fields.order_id')
const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

// Replaces placeholders like {{contact.name}} or {{trigger.some_data}} with actual data
const resolveVariables = (text: string, context: any): string => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getValueFromPath(context, path.trim());
        return value !== undefined ? String(value) : match; // Return the placeholder if not found
    });
};

// Replaces placeholders in a JSON string template with their actual values,
// ensuring the output is a valid JSON value representation.
const resolveJsonPlaceholders = (jsonString: string, context: any): string => {
    if (typeof jsonString !== 'string') {
        return JSON.stringify(jsonString);
    }
    
    // Pre-process to handle placeholders inside quotes like "{{var}}" -> {{var}}
    let processedJsonString = jsonString.replace(/"\{\{([^}]+)\}\}"/g, '{{$1}}');

    return processedJsonString.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getValueFromPath(context, path.trim());

        if (value === undefined) {
            return 'null'; // Replace unresolved variables with JSON null
        }
        if (value === null) {
            return 'null';
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return JSON.stringify(value);
    });
};

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
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const requestOptions: RequestInit = { method, headers };

        if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && webhookConfig.body) {
            try {
                const resolvedBody = resolveJsonPlaceholders(webhookConfig.body, context);
                JSON.parse(resolvedBody); // Validate it's valid JSON
                requestOptions.body = resolvedBody;
            } catch (e: any) {
                return res.status(400).json({ error: 'Falha ao criar um corpo JSON válido a partir do template.', details: e.message });
            }
        }

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
