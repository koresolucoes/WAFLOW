
// /api/webhook.ts
import { createClient } from '@supabase/supabase-js';
import { Database, Tables } from '../src/types/database.types';
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

// Helpers
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

const processStatuses = async (statuses: any[]) => {
    for (const status of statuses) {
        const updateData: { status: any; delivered_at?: string; read_at?: string } = { status: status.status };
        
        const timestamp = parseInt(status.timestamp, 10) * 1000;
        if (isNaN(timestamp)) continue;

        if (status.status === 'delivered') {
            updateData.delivered_at = new Date(timestamp).toISOString();
        }
        if (status.status === 'read') {
            updateData.read_at = new Date(timestamp).toISOString();
        }
        
        const { error } = await supabase
            .from('campaign_messages')
            .update(updateData as any)
            .eq('meta_message_id', status.id);

        if (error) {
            console.error(`Webhook: Erro ao atualizar status da mensagem ${status.id} para ${status.status}:`, error.message);
        } else {
            console.log(`Webhook: Status da mensagem ${status.id} atualizado para ${status.status}.`);
        }
    }
};

const executeAutomation = async (automation: Automation, contact: Contact, metaConfig: any) => {
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

const processIncomingMessages = async (messages: any[], userId: string, metaConfig: any) => {
    for (const message of messages) {
        if (message.type !== 'text') continue;

        const contactPhone = message.from;
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .eq('user_id', userId)
            .eq('phone', contactPhone)
            .single();

        if (contactError || !contact) {
            console.warn(`Webhook: Mensagem de contato desconhecido (${contactPhone}) para usuário ${userId}.`);
            continue;
        }

        // Save received message
        await supabase.from('received_messages').insert({
            user_id: userId,
            contact_id: (contact as Contact).id,
            meta_message_id: message.id,
            message_body: message.text?.body || '',
            received_at: new Date(parseInt(message.timestamp, 10) * 1000).toISOString()
        } as any);

        // Check for keyword automations
        const { data: automations, error: autoError } = await supabase
            .from('automations')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .eq('trigger_type', 'message_received_with_keyword');
        
        if (autoError) {
            console.error('Webhook: Erro ao buscar automações por palavra-chave:', autoError.message);
            continue;
        }

        const messageText = (message.text?.body || '').toLowerCase().trim();
        for (const auto of (automations as Automation[])) {
            const keyword = (((auto.trigger_config as any)?.keyword) || '').toLowerCase().trim();
            if (keyword && messageText.includes(keyword)) {
                console.log(`Webhook: Gatilho de palavra-chave '${keyword}' encontrado. Executando automação '${auto.name}'.`);
                await executeAutomation(auto, contact as Contact, metaConfig);
            }
        }
    }
};

const handleVerification = (req: Request): Response => {
    const url = new URL(req.url);
    const params = url.searchParams;
    const mode = params.get('hub.mode');
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } else {
        console.error('Falha na verificação do Webhook. Tokens não correspondem.');
        return new Response('Failed validation', { status: 403 });
    }
};

const handlePost = async (req: Request): Promise<Response> => {
    try {
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

                    if (!profile) {
                        console.error(`Webhook: Nenhum perfil encontrado para phone_number_id ${metadata.phone_number_id}. Ignorando.`);
                        continue;
                    }

                    const metaConfig = {
                        accessToken: (profile as Profile).meta_access_token,
                        wabaId: (profile as Profile).meta_waba_id,
                        phoneNumberId: (profile as Profile).meta_phone_number_id
                    };

                    if (value.statuses) {
                        await processStatuses(value.statuses);
                    }
                    if (value.messages) {
                        await processIncomingMessages(value.messages, (profile as Profile).id, metaConfig);
                    }
                }
            }
        }

        return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (error: any) {
        console.error('Webhook: Erro ao processar a requisição POST:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
};

export default async function handler(req: Request) {
    if (req.method === 'GET') {
        return handleVerification(req);
    } else if (req.method === 'POST') {
        return handlePost(req);
    } else {
        return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'GET, POST' } });
    }
}
