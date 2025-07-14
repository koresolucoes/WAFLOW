// /api/webhook.ts
import { createClient } from '@supabase/supabase-js';
import { Database, Tables, Json } from '../src/types/database.types';
import { Automation, Contact, MessageTemplate, Profile } from '../src/types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

if (!supabaseUrl || !supabaseServiceKey || !VERIFY_TOKEN) {
    throw new Error("Variáveis de ambiente do servidor não configuradas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_VERIFY_TOKEN são necessárias.");
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false
    }
});

// --- HELPER FUNCTIONS ---

const replacePlaceholders = (text: string, data: any): string => {
    if (typeof text !== 'string') return text;
    // Regex to find {{...}} placeholders
    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const keys = key.trim().split('.');
        let value = data;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return match; // Return original placeholder if path is invalid
            }
        }
        // If the resolved value is an object, stringify it. Otherwise, return as is.
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    });
};

const findProfileByPhoneNumberId = async (phoneId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, meta_access_token, meta_waba_id, meta_phone_number_id')
        .eq('meta_phone_number_id', phoneId)
        .single();
    if (error) {
        console.error(`Webhook: Erro ao buscar perfil pelo phone_number_id ${phoneId}:`, error.message);
        return null;
    }
    return data;
};

const sendTemplatedMessage = async (config: any, to: string, templateName: string, components: any[]) => {
    const API_VERSION = 'v23.0';
    const url = `https://graph.facebook.com/${API_VERSION}/${config.meta_phone_number_id}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'template',
        template: { name: templateName, language: { code: 'pt_BR' }, components }
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.meta_access_token}` },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta API Error: ${error.error.message}`);
    }
    return response.json();
};

// --- AUTOMATION EXECUTION LOGIC ---

const executeContactAutomation = async (automation: Automation, contact: Contact, metaConfig: any) => {
    try {
        if (automation.action_type === 'send_template') {
            const templateId = (automation.action_config as any)?.template_id;
            if (!templateId) throw new Error("ID do template não encontrado na automação.");

            const { data: template, error } = await supabase
                .from('message_templates')
                .select('template_name, status, components')
                .eq('id', templateId)
                .single();
            if (error || !template) throw error || new Error("Template não encontrado.");
            if ((template as MessageTemplate).status !== 'APPROVED') throw new Error(`Template '${(template as MessageTemplate).template_name}' não está APROVADO.`);
            
            await sendTemplatedMessage(metaConfig, contact.phone, (template as MessageTemplate).template_name, [{type: 'body', parameters: [{type: 'text', text: contact.name}]}]);

        } else if (automation.action_type === 'add_tag') {
            const tagToAdd = (automation.action_config as any)?.tag;
            if (!tagToAdd) throw new Error("Tag não configurada na automação.");
            const newTags = [...new Set([...(contact.tags || []), tagToAdd])];
            const { error } = await supabase.from('contacts').update({ tags: newTags } as any).eq('id', contact.id);
            if(error) throw error;
        }

        await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: 'success' } as any);
    } catch (err: any) {
        console.error(`Webhook: Falha ao executar automação ${automation.id} para contato ${contact.id}:`, err.message);
        await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: 'failed', details: err.message } as any);
    }
};

const executeGenericAutomation = async (automation: Automation, triggerData: any) => {
    const actionType = automation.action_type;
    const actionConfig = automation.action_config as any;

    try {
        if (actionType === 'http_request') {
            const url = replacePlaceholders(actionConfig.url, { trigger: triggerData });
            const method = actionConfig.method || 'POST';
            let headers: Record<string, string> = {};
            if (actionConfig.headers) {
                try {
                    // O header vem como uma string JSON, então precisa ser parseado.
                    // A string também pode conter placeholders, então eles são substituídos primeiro.
                    const replacedHeaderString = replacePlaceholders(actionConfig.headers, { trigger: triggerData });
                    headers = JSON.parse(replacedHeaderString);
                } catch (e) {
                    throw new Error("Formato JSON inválido nos Cabeçalhos (Headers).");
                }
            }
            
            let requestBody: any = undefined;
            if (method !== 'GET' && actionConfig.body) {
                // O corpo também pode conter placeholders
                requestBody = replacePlaceholders(actionConfig.body, { trigger: triggerData });
            }

            const httpResponse = await fetch(url, {
                method,
                headers,
                body: requestBody,
            });

            if (!httpResponse.ok) {
                const responseBody = await httpResponse.text();
                throw new Error(`Requisição HTTP falhou com status ${httpResponse.status}: ${responseBody}`);
            }
        } else {
            // Outras ações genéricas que não dependem de um contato podem ser adicionadas aqui.
            throw new Error(`Ação '${actionType}' não é compatível com gatilhos de webhook genéricos.`);
        }
        
        // Log de sucesso
        await supabase.from('automation_runs').insert({
            automation_id: automation.id,
            status: 'success',
            details: `Ação '${actionType}' executada com sucesso via webhook.`
        } as any);

    } catch (executionError: any) {
        // Log de falha
        console.error(`Webhook Trigger: Falha ao executar ação para automação ${automation.id}:`, executionError.message);
        await supabase.from('automation_runs').insert({
            automation_id: automation.id,
            status: 'failed',
            details: executionError.message,
        } as any);
        // Lançar o erro novamente para que o manipulador principal saiba que falhou.
        throw executionError;
    }
};


// --- WEBHOOK HANDLERS ---

const handleMetaPost = async (req: Request): Promise<Response> => {
    const body = await req.json();

    if (body.object !== 'whatsapp_business_account') {
        return new Response('Not a WhatsApp Business Account notification', { status: 200 });
    }
    
    for (const entry of body.entry) {
        for (const change of entry.changes) {
            if (change.field === 'messages') {
                const value = change.value;
                const metadata = value.metadata;
                
                const profile = await findProfileByPhoneNumberId(metadata.phone_number_id);
                if (!profile) continue;

                const metaConfig = { accessToken: (profile as Profile).meta_access_token, phoneNumberId: (profile as Profile).meta_phone_number_id };

                // Processar status de mensagens de campanhas
                if (value.statuses) {
                    for (const status of value.statuses) {
                        const { error } = await supabase.from('campaign_messages').update({ status: status.status } as any).eq('meta_message_id', status.id);
                        if (error) console.error(`Webhook: Erro ao atualizar status da mensagem ${status.id}:`, error.message);
                    }
                }
                
                // Processar mensagens recebidas e automações de palavra-chave
                if (value.messages) {
                    for (const message of value.messages) {
                        if (message.type !== 'text') continue;

                        const { data: contact } = await supabase.from('contacts').select('*').eq('user_id', profile.id).eq('phone', message.from).single();
                        if (!contact) continue;

                        await supabase.from('received_messages').insert({ user_id: profile.id, contact_id: contact.id, meta_message_id: message.id, message_body: message.text?.body || '' } as any);

                        const { data: automations } = await supabase.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active').eq('trigger_type', 'message_received_with_keyword');
                        if (automations) {
                            const messageText = (message.text?.body || '').toLowerCase().trim();
                            for (const auto of automations) {
                                const keyword = (((auto.trigger_config as any)?.keyword) || '').toLowerCase().trim();
                                if (keyword && messageText.includes(keyword)) {
                                    await executeContactAutomation(auto, contact, metaConfig);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return new Response('EVENT_RECEIVED', { status: 200 });
};

const handleAutomationTrigger = async (req: Request, automationId: string): Promise<Response> => {
    const { data: automation, error: autoError } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .eq('status', 'active')
        .eq('trigger_type', 'webhook_received')
        .single();

    if (autoError || !automation) {
        return new Response('Automation not found or not a valid webhook trigger.', { status: 404 });
    }

    let body: any = {};
    try {
        const contentType = req.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            body = await req.json();
        } else {
            body = await req.text();
        }
    } catch (e) {}

    const triggerData = {
        body,
        query: Object.fromEntries(new URL(req.url).searchParams),
        headers: Object.fromEntries(req.headers),
    };

    try {
        await executeGenericAutomation(automation, triggerData);
        // Mesmo se a execução da automação falhar, o webhook foi recebido com sucesso.
        // A falha é registrada internamente na tabela automation_runs.
        return new Response('Webhook processed.', { status: 200 });
    } catch (error: any) {
        // Este erro é capturado se executeGenericAutomation falhar, mas o log já foi feito lá.
        // Retornamos 200 para não fazer o serviço de origem tentar reenviar o webhook.
        return new Response(`Webhook processed, but action failed: ${error.message}`, { status: 200 });
    }
};

const handleVerification = (req: Request): Response => {
    const params = new URL(req.url).searchParams;
    if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(params.get('hub.challenge'), { status: 200 });
    }
    return new Response('Failed validation', { status: 403 });
};


// --- MAIN HANDLER ---
export default async function handler(req: Request) {
    try {
        const url = new URL(req.url);
        const triggerId = url.searchParams.get('trigger_id');

        // Rota 1: Gatilho de Automação Genérico
        if (triggerId) {
            return await handleAutomationTrigger(req, triggerId);
        }

        // Rota 2: Verificação do Webhook da Meta
        if (req.method === 'GET') {
            return handleVerification(req);
        }

        // Rota 3: Notificações do Webhook da Meta
        if (req.method === 'POST') {
            return await handleMetaPost(req);
        }

        // Método não suportado
        return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'GET, POST' } });

    } catch (error: any) {
        console.error('Webhook: Erro Crítico no Handler Principal:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}