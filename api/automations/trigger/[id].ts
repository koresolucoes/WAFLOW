// /api/automations/trigger/[id].ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables } from '../../../src/types/database.types';

// Headers for CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
};

// --- HELPER FUNCTIONS ---

const replacePlaceholders = (text: string, data: any): string => {
    if (typeof text !== 'string') return text;
    // Regex para encontrar placeholders como {{...}}
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const keys = key.trim().split('.');
        let value = data;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return match; // Retorna o placeholder original se o caminho for inválido
            }
        }
        // Se o valor resolvido for um objeto, converte para string. Caso contrário, retorna como está.
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    });
};

const executeGenericAutomation = async (supabase: SupabaseClient<Database>, automation: Tables<'automations'>, triggerData: any) => {
    const actionType = automation.action_type;
    const actionConfig = automation.action_config as any;

    try {
        if (actionType === 'http_request') {
            const url = replacePlaceholders(actionConfig.url, { trigger: triggerData });
            const method = actionConfig.method || 'POST';
            let headers: Record<string, string> = {};
            if (actionConfig.headers) {
                try {
                    const replacedHeaderString = replacePlaceholders(actionConfig.headers, { trigger: triggerData });
                    headers = JSON.parse(replacedHeaderString);
                } catch (e) {
                    throw new Error("Formato JSON inválido nos Cabeçalhos (Headers).");
                }
            }
            
            let requestBody: any = undefined;
            if (method !== 'GET' && actionConfig.body) {
                requestBody = replacePlaceholders(actionConfig.body, { trigger: triggerData });
            }

            const httpResponse = await fetch(url, { method, headers, body: requestBody });
            const responseBodyText = await httpResponse.text();

            if (!httpResponse.ok) {
                throw new Error(`Requisição HTTP falhou com status ${httpResponse.status}: ${responseBodyText}`);
            }
            
            await supabase.from('automation_runs').insert({
                automation_id: automation.id,
                status: 'success',
                details: `Ação '${actionType}' executada com sucesso via webhook. Status: ${httpResponse.status}`
            } as any);

            return { status: httpResponse.status, body: responseBodyText, headers: httpResponse.headers };
        } else {
            throw new Error(`Ação '${actionType}' não é compatível com gatilhos de webhook genéricos.`);
        }

    } catch (executionError: any) {
        console.error(`Webhook Trigger: Falha ao executar ação para automação ${automation.id}:`, executionError.message);
        await supabase.from('automation_runs').insert({
            automation_id: automation.id,
            status: 'failed',
            details: executionError.message,
        } as any);
        throw executionError;
    }
};

// --- MAIN HANDLER ---
export default async function handler(req: Request) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    const {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
    } = process.env;

    const errorResponse = (message: string, status = 500) => new Response(JSON.stringify({ message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    if (!supabaseUrl) return errorResponse('Erro de configuração do servidor: SUPABASE_URL não foi encontrada.');
    if (!supabaseServiceKey) return errorResponse('Erro de configuração do servidor: SUPABASE_SERVICE_ROLE_KEY não foi encontrada.');
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const automationId = pathSegments[pathSegments.length - 1];

    if (!automationId) {
        return errorResponse('ID da automação ausente na URL.', 400);
    }

    try {
        const { data: automationData, error: autoError } = await supabase
            .from('automations')
            .select('*')
            .eq('id', automationId)
            .eq('status', 'active')
            .eq('trigger_type', 'webhook_received')
            .single();
        
        const automation = automationData as unknown as Tables<'automations'>;
        if (autoError || !automation) {
            return errorResponse('Automação não encontrada, inativa ou não é do tipo webhook.', 404);
        }
        
        const triggerConfig = automation.trigger_config as any;
        
        const expectedKey = triggerConfig?.verify_key;
        if (expectedKey) {
            const authHeader = req.headers.get('Authorization');
            const apiKeyHeader = req.headers.get('x-api-key');
            let providedKey: string | null = null;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                providedKey = authHeader.substring(7);
            } else if (apiKeyHeader) {
                providedKey = apiKeyHeader;
            }

            if (providedKey !== expectedKey) {
                return errorResponse('Não autorizado: chave de verificação inválida.', 401);
            }
        }
        
        const allowedMethod = triggerConfig?.method || 'POST';
        if (allowedMethod !== 'ANY' && req.method !== allowedMethod) {
            return new Response(`Método não permitido. Este webhook aceita apenas requisições ${allowedMethod}.`, {
                status: 405,
                headers: { ...corsHeaders, 'Allow': allowedMethod }
            });
        }

        let body: any = {};
        try {
            const contentType = req.headers.get('content-type');
            const textBody = await req.text();

            if (textBody) {
                 if (contentType && contentType.includes('application/json')) {
                    body = JSON.parse(textBody);
                } else {
                    body = textBody; // Passa como texto puro se não for JSON
                }
            }
        } catch (e) {
            console.warn(`Webhook: Não foi possível parsear o corpo da requisição para a automação ${automationId}.`, e);
        }

        const triggerData = {
            body,
            query: Object.fromEntries(url.searchParams),
            headers: Object.fromEntries(req.headers),
        };

        const waitForResponse = triggerConfig?.waitForResponse || false;

        if (waitForResponse) {
            try {
                const result = await executeGenericAutomation(supabase, automation, triggerData);
                const contentType = result.headers.get('content-type') || 'application/json';
                return new Response(result.body, { status: result.status, headers: { ...corsHeaders, 'Content-Type': contentType } });
            } catch (executionError: any) {
                return errorResponse(executionError.message);
            }
        } else {
            executeGenericAutomation(supabase, automation, triggerData).catch(err => {
                console.error(`Webhook Trigger: Execução assíncrona falhou para a automação ${automation.id}:`, err.message);
            });
            return new Response(JSON.stringify({ message: 'Webhook recebido e está sendo processado.' }), { 
                status: 202,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
        }
    } catch (error: any) {
        console.error(`Webhook Trigger: Erro crítico para automação ${automationId}:`, error);
        return errorResponse('Erro Interno do Servidor');
    }
}