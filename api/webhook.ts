// /api/webhook.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables } from '../src/types/database.types';
import { Automation, Contact, AutomationNode, MessageTemplate } from '../src/types';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// Flow Execution Engine (Simplified)
// ============================================================================

async function sendWhatsAppTemplate(metaConfig: any, to: string, template: MessageTemplate, contactName: string) {
    const API_VERSION = 'v23.0';
    const url = `https://graph.facebook.com/${metaConfig.meta_phone_number_id}/messages`;
    
    // Simplificado para substituir {{1}} pelo nome do contato
    const components = [{
        type: 'body',
        parameters: [{ type: 'text', text: contactName }]
    }];

    const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'template',
        template: { name: template.template_name, language: { code: 'pt_BR' }, components }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${metaConfig.meta_access_token}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta API Error: ${error.error.message}`);
    }
    return response.json();
}


async function executeActionNode(supabase: SupabaseClient<Database>, node: AutomationNode, contact: Contact, metaConfig: any) {
    const actionType = node.data.type;
    const actionConfig = node.data.config as any;

    try {
        if (actionType === 'send_template') {
            if (!actionConfig.template_id) throw new Error("ID do template não configurado na ação.");

            const { data: template, error } = await supabase
                .from('message_templates').select('*').eq('id', actionConfig.template_id).single();
            
            if (error || !template) throw error || new Error("Template não encontrado.");
            if (template.status !== 'APPROVED') throw new Error(`Template '${template.template_name}' não está APROVADO.`);
            
            await sendWhatsAppTemplate(metaConfig, contact.phone, template as MessageTemplate, contact.name);

        } else if (actionType === 'add_tag') {
            if (!actionConfig.tag) throw new Error("Tag não configurada na ação.");
            const newTags = [...new Set([...(contact.tags || []), actionConfig.tag])];
            const { error } = await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
            if (error) throw error;
        }

        return { success: true, details: `Ação '${actionType}' executada.` };
    } catch (err: any) {
        return { success: false, details: err.message };
    }
}

async function executeFlow(supabase: SupabaseClient<Database>, automation: Automation, startNodeId: string, contact: Contact, metaConfig: any) {
    const edgesFromStart = automation.edges.filter(edge => edge.source === startNodeId);
    
    for (const edge of edgesFromStart) {
        const nextNode = automation.nodes.find(node => node.id === edge.target);
        if (nextNode && nextNode.data.nodeType === 'action') {
            const result = await executeActionNode(supabase, nextNode, contact, metaConfig);
            await supabase.from('automation_runs').insert({
                automation_id: automation.id,
                contact_id: contact.id,
                status: result.success ? 'success' : 'failed',
                details: result.details,
            });
        }
    }
}

// ============================================================================
// Webhook Payload Processor
// ============================================================================

async function findProfileByPhoneNumberId(supabase: SupabaseClient<Database>, phoneId: string): Promise<Tables<'profiles'> | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('meta_phone_number_id', phoneId)
        .single();
    if (error) {
        console.error(`Webhook: Erro ao buscar perfil pelo phone_number_id ${phoneId}:`, error.message);
        return null;
    }
    return data;
};


async function processMetaPayload(supabase: SupabaseClient<Database>, body: any) {
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry) {
        for (const change of entry.changes) {
            if (change.field !== 'messages') continue;
            
            const value = change.value;
            const profile = await findProfileByPhoneNumberId(supabase, value.metadata.phone_number_id);
            if (!profile) continue;

            const metaConfig = {
                meta_access_token: profile.meta_access_token,
                meta_phone_number_id: profile.meta_phone_number_id,
            };

            // Process status updates
            if (value.statuses) {
                for (const status of value.statuses) {
                    await supabase.from('campaign_messages').update({ status: status.status }).eq('meta_message_id', status.id);
                }
            }

            // Process incoming messages and trigger automations
            if (value.messages) {
                const { data: automationsData } = await supabase.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active');
                const automations = (automationsData as Automation[]) || [];
                if (automations.length === 0) continue;

                for (const message of value.messages) {
                    if (message.type !== 'text' || !message.text?.body) continue;

                    const { data: contact } = await supabase.from('contacts').select('*').eq('user_id', profile.id).eq('phone', message.from).single();
                    if (!contact) continue;

                    await supabase.from('received_messages').insert({ user_id: profile.id, contact_id: contact.id, meta_message_id: message.id, message_body: message.text.body });
                    
                    const messageText = message.text.body.toLowerCase().trim();

                    for (const auto of automations) {
                        const triggerNode = auto.nodes.find(n => 
                            n.data.nodeType === 'trigger' &&
                            n.data.type === 'message_received_with_keyword' &&
                            messageText.includes(((n.data.config as any)?.keyword || 'NON_EXISTENT_KEYWORD').toLowerCase().trim())
                        );

                        if (triggerNode) {
                            await executeFlow(supabase, auto, triggerNode.id, contact, metaConfig);
                        }
                    }
                }
            }
        }
    }
}


// ============================================================================
// Main Handler
// ============================================================================
const handleVerification = (req: Request, verifyToken: string): Response => {
    const params = new URL(req.url).searchParams;
    if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === verifyToken) {
        return new Response(params.get('hub.challenge'), { status: 200 });
    }
    return new Response('Failed validation', { status: 403 });
};

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_VERIFY_TOKEN } = process.env;
    const errorResponse = (msg: string) => new Response(JSON.stringify({ message: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return errorResponse('Variáveis de ambiente do Supabase não configuradas.');
    
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    try {
        if (req.method === 'GET') {
            if (!META_VERIFY_TOKEN) return errorResponse('META_VERIFY_TOKEN não configurado.');
            return handleVerification(req, META_VERIFY_TOKEN);
        }

        if (req.method === 'POST') {
            const body = await req.json();
            // Process in background to immediately return 200 OK to Meta
            processMetaPayload(supabase, body).catch(err => console.error("Webhook: Erro durante o processamento de evento da Meta:", err.message));
            return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
        }

        return new Response('Method Not Allowed', { status: 405, headers: { ...corsHeaders, 'Allow': 'GET, POST' } });
    } catch (error: any) {
        console.error('Webhook: Erro Crítico no Handler:', error);
        return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
}