// /api/webhook.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database.types';
import { Contact, Profile, Automation, MessageTemplate, MessageStatus, TablesInsert } from '../src/types';

// Headers for CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};


// --- HELPER FUNCTIONS FOR META ---

const findProfileByPhoneNumberId = async (supabase: SupabaseClient<Database>, phoneId: string): Promise<Profile | null> => {
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

const executeContactAutomation = async (supabase: SupabaseClient<Database>, automation: Automation, contact: Contact, metaConfig: any) => {
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
            const template = templateData as MessageTemplate;
            if (template.status !== 'APPROVED') throw new Error(`Template '${template.template_name}' não está APROVADO.`);
            
            await sendTemplatedMessage(metaConfig, contact.phone, template.template_name, [{type: 'body', parameters: [{type: 'text', text: contact.name}]}]);

        } else if (automation.action_type === 'add_tag') {
            const tagToAdd = (automation.action_config as any)?.tag;
            if (!tagToAdd) throw new Error("Tag não configurada na automação.");
            const newTags = [...new Set([...(contact.tags || []), tagToAdd])];
            const { error } = await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
            if(error) throw error;
        }

        await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: 'success' });
    } catch (err: any) {
        console.error(`Webhook: Falha ao executar automação ${automation.id} para contato ${contact.id}:`, err.message);
        await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: 'failed', details: err.message });
    }
};

// --- BACKGROUND PROCESSING FOR META ---

async function processMetaPayload(supabase: SupabaseClient<Database>, body: any) {
    if (body.object !== 'whatsapp_business_account') {
        return;
    }

    for (const entry of body.entry) {
        for (const change of entry.changes) {
            if (change.field === 'messages') {
                const value = change.value;
                const metadata = value.metadata;

                const profile = await findProfileByPhoneNumberId(supabase, metadata.phone_number_id);
                if (!profile) continue;

                const typedProfile = profile;
                const metaConfig = {
                    meta_access_token: typedProfile.meta_access_token,
                    meta_phone_number_id: typedProfile.meta_phone_number_id
                };

                if (value.statuses) {
                    for (const status of value.statuses) {
                        const { error } = await supabase.from('campaign_messages').update({ status: status.status }).eq('meta_message_id', status.id);
                        if (error) console.error(`Webhook: Erro ao atualizar status da mensagem ${status.id}:`, error.message);
                    }
                }

                if (value.messages) {
                    for (const message of value.messages) {
                        if (message.type !== 'text') continue;

                        const { data: contactData } = await supabase.from('contacts').select('*').eq('user_id', typedProfile.id).eq('phone', message.from).single();
                        if (!contactData) continue;
                        const contact = contactData;

                        await supabase.from('received_messages').insert({ user_id: typedProfile.id, contact_id: contact.id, meta_message_id: message.id, message_body: message.text?.body || '' });

                        const { data: automationsData } = await supabase.from('automations').select('*').eq('user_id', typedProfile.id).eq('status', 'active').eq('trigger_type', 'message_received_with_keyword');
                        const automations = (automationsData as Automation[]) || [];

                        if (automations.length > 0) {
                            const messageText = (message.text?.body || '').toLowerCase().trim();
                            for (const auto of automations) {
                                const keyword = (((auto.trigger_config as any)?.keyword) || '').toLowerCase().trim();
                                if (keyword && messageText.includes(keyword)) {
                                    await executeContactAutomation(supabase, auto, contact, metaConfig);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}


// --- WEBHOOK HANDLERS FOR META ---

const handleMetaPost = async (supabase: SupabaseClient<Database>, req: Request): Promise<Response> => {
    const body = await req.json();
    processMetaPayload(supabase, body).catch(err => {
        console.error("Webhook: Error during background processing of Meta event:", err.message);
    });
    return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
};

const handleVerification = (req: Request, verifyToken: string): Response => {
    const params = new URL(req.url).searchParams;
    if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === verifyToken) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(params.get('hub.challenge'), { status: 200 });
    }
    return new Response('Failed validation', { status: 403 });
};


// --- MAIN HANDLER ---
export default async function handler(req: Request) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    const {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
        META_VERIFY_TOKEN: verifyToken,
    } = process.env;

    const errorResponse = (message: string) => new Response(JSON.stringify({ message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    if (!supabaseUrl) return errorResponse('Erro de configuração do servidor: SUPABASE_URL não foi encontrada.');
    if (!supabaseServiceKey) return errorResponse('Erro de configuração do servidor: SUPABASE_SERVICE_ROLE_KEY não foi encontrada.');
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });

    try {
        if (req.method === 'GET') {
            if (!verifyToken) return errorResponse('Erro de configuração do servidor: META_VERIFY_TOKEN não foi encontrada.');
            return handleVerification(req, verifyToken);
        }

        if (req.method === 'POST') {
            return await handleMetaPost(supabase, req);
        }

        return new Response('Method Not Allowed', { status: 405, headers: { ...corsHeaders, 'Allow': 'GET, POST' } });

    } catch (error: any) {
        console.error('Webhook: Erro Crítico no Handler Principal:', error);
        return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
}
