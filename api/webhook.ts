
// /api/webhook.ts
import { createClient } from '@supabase/supabase-js';
import { Database, Tables } from '../src/types/database.types';
import { Contact } from '../src/types';

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
    return data as unknown as (Tables<'profiles'> | null);
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

const executeContactAutomation = async (automation: Tables<'automations'>, contact: Contact, metaConfig: any) => {
    try {
        if (automation.action_type === 'send_template') {
            const templateId = (automation.action_config as any)?.template_id;
            if (!templateId) throw new Error("ID do template não encontrado na automação.");

            const { data: templateData, error } = await supabase
                .from('message_templates')
                .select('template_name, status, components')
                .eq('id', templateId)
                .single();
            if (error || !templateData) throw error || new Error("Template não encontrado.");
            const template = templateData as unknown as Tables<'message_templates'>;
            if (template.status !== 'APPROVED') throw new Error(`Template '${template.template_name}' não está APROVADO.`);
            
            await sendTemplatedMessage(metaConfig, contact.phone, template.template_name, [{type: 'body', parameters: [{type: 'text', text: contact.name}]}]);

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

const executeGenericAutomation = async (automation: Tables<'automations'>, triggerData: any) => {
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

// --- BACKGROUND PROCESSING ---

async function processMetaPayload(body: any) {
    if (body.object !== 'whatsapp_business_account') {
        return;
    }

    for (const entry of body.entry) {
        for (const change of entry.changes) {
            if (change.field === 'messages') {
                const value = change.value;
                const metadata = value.metadata;

                const profile = await findProfileByPhoneNumberId(metadata.phone_number_id);
                if (!profile) continue;

                const typedProfile = profile as any;
                const metaConfig = {
                    meta_access_token: typedProfile.meta_access_token,
                    meta_phone_number_id: typedProfile.meta_phone_number_id
                };

                if (value.statuses) {
                    for (const status of value.statuses) {
                        const { error } = await supabase.from('campaign_messages').update({ status: status.status } as any).eq('meta_message_id', status.id);
                        if (error) console.error(`Webhook: Erro ao atualizar status da mensagem ${status.id}:`, error.message);
                    }
                }

                if (value.messages) {
                    for (const message of value.messages) {
                        if (message.type !== 'text') continue;

                        const { data: contactData } = await supabase.from('contacts').select('*').eq('user_id', typedProfile.id).eq('phone', message.from).single();
                        if (!contactData) continue;
                        const contact = contactData as unknown as Contact;

                        await supabase.from('received_messages').insert({ user_id: typedProfile.id, contact_id: contact.id, meta_message_id: message.id, message_body: message.text?.body || '' } as any);

                        const { data: automationsData } = await supabase.from('automations').select('*').eq('user_id', typedProfile.id).eq('status', 'active').eq('trigger_type', 'message_received_with_keyword');
                        const automations = (automationsData as unknown as Tables<'automations'>[]) || [];

                        if (automations.length > 0) {
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
}


// --- WEBHOOK HANDLERS ---

const handleMetaPost = async (req: Request): Promise<Response> => {
    const body = await req.json();
    processMetaPayload(body).catch(err => {
        console.error("Webhook: Error during background processing of Meta event:", err.message);
    });
    return new Response('EVENT_RECEIVED', { status: 200 });
};

const handleAutomationTrigger = async (req: Request, automationId: string): Promise<Response> => {
    const { data: automationData, error: autoError } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .eq('status', 'active')
        .eq('trigger_type', 'webhook_received')
        .single();
    
    const automation = automationData as unknown as Tables<'automations'>;
    if (autoError || !automation) {
        return new Response('Automation not found or not a valid webhook trigger.', { status: 404 });
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
            return new Response('Unauthorized: Invalid verification key.', { status: 401 });
        }
    }
    
    const allowedMethod = triggerConfig?.method || 'POST';
    if (allowedMethod !== 'ANY' && req.method !== allowedMethod) {
        return new Response(`Method Not Allowed. This webhook only accepts ${allowedMethod} requests.`, {
            status: 405,
            headers: { 'Allow': allowedMethod }
        });
    }

    let body: any = {};
    try {
        const contentType = req.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const textBody = await req.text();
            if (textBody) body = JSON.parse(textBody);
        } else {
            const textBody = await req.text();
            if(textBody) body = textBody;
        }
    } catch (e) {
         console.warn(`Webhook: Could not parse body for automation ${automationId}.`, e);
    }

    const triggerData = {
        body,
        query: Object.fromEntries(new URL(req.url).searchParams),
        headers: Object.fromEntries(req.headers),
    };

    const waitForResponse = triggerConfig?.waitForResponse || false;

    if (waitForResponse) {
        try {
            const result = await executeGenericAutomation(automation, triggerData);
            const contentType = result.headers.get('content-type') || 'application/json';
            return new Response(result.body, { status: result.status, headers: { 'Content-Type': contentType } });
        } catch (executionError: any) {
            return new Response(JSON.stringify({ error: executionError.message }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } else {
        executeGenericAutomation(automation, triggerData).catch(err => {
            console.error(`Webhook Trigger: Async execution failed for automation ${automation.id}:`, err.message);
        });
        return new Response('Webhook received and is being processed.', { status: 202 });
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

        if (triggerId) {
            return await handleAutomationTrigger(req, triggerId);
        }

        if (req.method === 'GET') {
            return handleVerification(req);
        }

        if (req.method === 'POST') {
            return await handleMetaPost(req);
        }

        return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'GET, POST' } });

    } catch (error: any) {
        console.error('Webhook: Erro Crítico no Handler Principal:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
