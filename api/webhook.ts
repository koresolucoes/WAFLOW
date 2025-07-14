// /api/webhook.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables, Json, TablesInsert } from '../src/types/database.types';
import { Automation, Contact, AutomationNode, MessageTemplate, MessageStatus } from '../src/types';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// Flow Execution Engine
// ============================================================================
const API_VERSION = 'v23.0';
const BASE_META_URL = `https://graph.facebook.com/${API_VERSION}`;

async function sendWhatsAppRequest(metaConfig: any, to: string, payload: any) {
    const url = `${BASE_META_URL}/${metaConfig.meta_phone_number_id}/messages`;
    const finalPayload = { ...payload, messaging_product: 'whatsapp', to: to.replace(/\D/g, '') };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${metaConfig.meta_access_token}` },
        body: JSON.stringify(finalPayload)
    });
    if (!response.ok) {
        const error = await response.json();
        console.error("Meta API Error Response:", error.error);
        throw new Error(`Meta API Error: ${error.error.message}`);
    }
    return response.json();
}

// Helper: Envia uma mensagem de texto simples
async function sendWhatsAppTextMessage(metaConfig: any, to: string, text: string) {
    return sendWhatsAppRequest(metaConfig, to, { type: 'text', text: { body: text } });
}

// Helper: Envia uma mensagem de template
async function sendWhatsAppTemplate(metaConfig: any, to: string, template: MessageTemplate, contact: Contact) {
    const parameters = (template.components?.find(c => c.type === 'BODY')?.text?.match(/\{\{1\}\}/g) || []).map(() => ({ type: 'text', text: contact.name }));
    const components = parameters.length > 0 ? [{ type: 'body', parameters }] : [];
    return sendWhatsAppRequest(metaConfig, to, {
        type: 'template',
        template: { name: template.template_name, language: { code: 'pt_BR' }, components }
    });
}

// Helper: Envia uma mídia
async function sendWhatsAppMedia(metaConfig: any, to: string, config: any) {
    const mediaPayload: any = { type: config.media_type };
    mediaPayload[config.media_type] = { link: config.media_url, caption: config.caption };
    return sendWhatsAppRequest(metaConfig, to, mediaPayload);
}

// Helper: Envia mensagem interativa
async function sendWhatsAppInteractiveMessage(metaConfig: any, to: string, config: any) {
    return sendWhatsAppRequest(metaConfig, to, {
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: config.message_text },
            action: {
                buttons: (config.buttons || []).map((btn: any) => ({
                    type: 'reply',
                    reply: { id: btn.id, title: btn.text }
                }))
            }
        }
    });
}

// Helper: Avalia uma condição de um nó de lógica
async function evaluateCondition(node: AutomationNode, contact: Contact): Promise<boolean> {
    const config = node.data.config as any;
    if (!config.field || !config.operator) return false;

    let contactValue;
    if (config.field === 'tags') {
        contactValue = contact.tags || [];
    } else if (config.field === 'name') {
        contactValue = contact.name || '';
    } else { // Custom field
        contactValue = (contact.custom_fields as any)?.[config.field] ?? '';
    }

    switch (config.operator) {
        case 'contains':
            return Array.isArray(contactValue) ? contactValue.includes(config.value) : String(contactValue).includes(config.value);
        case 'not_contains':
            return Array.isArray(contactValue) ? !contactValue.includes(config.value) : !String(contactValue).includes(config.value);
        case 'equals':
            return String(contactValue) === config.value;
        default:
            return false;
    }
}

// Helper: Executa uma ação de um nó
async function executeActionNode(supabase: SupabaseClient<Database>, node: AutomationNode, contact: Contact, metaConfig: any) {
    const actionType = node.data.type;
    const actionConfig = node.data.config as any;
    let details = `Ação '${actionType}' executada.`;

    try {
        switch(actionType) {
            case 'send_template':
                if (!actionConfig.template_id) throw new Error("ID do template não configurado na ação.");
                const { data: template, error } = await supabase.from('message_templates').select('*').eq('id', actionConfig.template_id).single();
                if (error || !template) throw error || new Error("Template não encontrado.");
                const typedTemplate = template as unknown as MessageTemplate;
                if (typedTemplate.status !== 'APPROVED') throw new Error(`Template '${typedTemplate.template_name}' não está APROVADO.`);
                await sendWhatsAppTemplate(metaConfig, contact.phone, typedTemplate, contact);
                break;
            case 'add_tag':
                if (!actionConfig.tag) throw new Error("Tag não configurada na ação.");
                const newTags = [...new Set([...(contact.tags || []), actionConfig.tag])];
                await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
                break;
            case 'remove_tag':
                if (!actionConfig.tag) throw new Error("Tag não configurada na ação.");
                const filteredTags = (contact.tags || []).filter(t => t !== actionConfig.tag);
                await supabase.from('contacts').update({ tags: filteredTags }).eq('id', contact.id);
                break;
            case 'set_custom_field':
                 if (!actionConfig.field_name) throw new Error("Nome do campo não configurado.");
                 const newCustomFields = { ...(contact.custom_fields as object || {}), [actionConfig.field_name]: actionConfig.field_value };
                 await supabase.from('contacts').update({ custom_fields: newCustomFields }).eq('id', contact.id);
                 break;
            case 'send_text_message':
                if (!actionConfig.message_text) throw new Error("Texto da mensagem não configurado.");
                const messageText = actionConfig.message_text.replace(/\{\{contact\.name\}\}/g, contact.name || '');
                await sendWhatsAppTextMessage(metaConfig, contact.phone, messageText);
                break;
            case 'send_media':
                if(!actionConfig.media_url) throw new Error("URL da mídia não configurada.");
                await sendWhatsAppMedia(metaConfig, contact.phone, actionConfig);
                break;
            case 'send_interactive_message':
                if (!actionConfig.message_text || !actionConfig.buttons) throw new Error("Mensagem ou botões não configurados.");
                await sendWhatsAppInteractiveMessage(metaConfig, contact.phone, actionConfig);
                break;
            case 'send_webhook':
                if (!actionConfig.url) throw new Error("URL do webhook não configurada.");
                const body = JSON.parse(actionConfig.body.replace(/\{\{contact\.name\}\}/g, contact.name || ''));
                await fetch(actionConfig.url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ...body, contact }) });
                break;
        }
        return { success: true, details };
    } catch (err: any) {
        return { success: false, details: err.message };
    }
}

// Core: Executa o fluxo da automação
async function executeFlow(supabase: SupabaseClient<Database>, automation: Automation, startNodeId: string, contact: Contact, metaConfig: any) {
    const queue: string[] = [startNodeId];
    const visited: Set<string> = new Set();

    while (queue.length > 0) {
        const currentNodeId = queue.shift()!;
        if (visited.has(currentNodeId)) continue;
        visited.add(currentNodeId);

        const currentNode = automation.nodes.find(node => node.id === currentNodeId);
        if (!currentNode) continue;

        const nodeType = currentNode.data.nodeType;

        try {
            if (nodeType === 'trigger') {
                const edge = automation.edges.find(e => e.source === currentNodeId);
                if (edge) queue.push(edge.target);
            } else if (nodeType === 'action') {
                const result = await executeActionNode(supabase, currentNode, contact, metaConfig);
                await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: result.success ? 'success' : 'failed', details: result.details });
                if (result.success) {
                    const edge = automation.edges.find(e => e.source === currentNodeId);
                    if (edge) queue.push(edge.target);
                } else {
                    break; // Para o fluxo em caso de falha na ação
                }
            } else if (nodeType === 'logic') {
                if (currentNode.data.type === 'condition') {
                    const conditionResult = await evaluateCondition(currentNode, contact);
                    const handleId = conditionResult ? 'yes' : 'no';
                    const edge = automation.edges.find(e => e.source === currentNodeId && e.sourceHandle === handleId);
                    if (edge) queue.push(edge.target);
                } else if (currentNode.data.type === 'split_path') {
                    const handleId = Math.random() < 0.5 ? 'a' : 'b';
                    const edge = automation.edges.find(e => e.source === currentNodeId && e.sourceHandle === handleId);
                    if (edge) queue.push(edge.target);
                }
            }
        } catch (error: any) {
            console.error(`Erro ao executar o nó ${currentNodeId} da automação ${automation.id}:`, error.message);
            await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: 'failed', details: `Erro no nó ${currentNode.data.label}: ${error.message}`});
            break;
        }
    }
}


// ============================================================================
// Webhook Payload Processor
// ============================================================================

async function findProfileByPhoneNumberId(supabase: SupabaseClient<Database>, phoneId: string): Promise<Tables<'profiles'> | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('meta_phone_number_id', phoneId).single();
    if (error) {
        console.error(`Webhook: Erro ao buscar perfil pelo phone_number_id ${phoneId}:`, error.message);
        return null;
    }
    return data as unknown as Tables<'profiles'> | null;
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
                    await supabase.from('campaign_messages').update({ status: status.status as MessageStatus, delivered_at: status.status === 'delivered' ? new Date().toISOString() : null, read_at: status.status === 'read' ? new Date().toISOString() : null }).eq('meta_message_id', status.id);
                }
            }

            // Process incoming messages and trigger automations
            if (value.messages) {
                const { data: automationsData } = await supabase.from('automations').select('*, nodes:nodes, edges:edges').eq('user_id', profile.id).eq('status', 'active');
                const automations = (automationsData as unknown as Automation[]) || [];
                if (automations.length === 0) continue;

                for (const message of value.messages) {
                    let { data: contactData, error: contactError } = await supabase.from('contacts').select('*').eq('user_id', profile.id).eq('phone', message.from).single();
                    
                    if(contactError && contactError.code !== 'PGRST116') {
                        console.error(`Webhook: Erro ao buscar contato ${message.from}:`, contactError.message);
                        continue; // Pula para a próxima mensagem
                    }
                    
                    let isNewContact = false;
                    
                    if (!contactData) {
                        const { data: newContact, error: createError } = await supabase
                            .from('contacts')
                            .insert({
                                user_id: profile.id,
                                phone: message.from,
                                name: value.contacts?.[0]?.profile?.name || message.from,
                                tags: ['lead'],
                            })
                            .select()
                            .single();
                        
                        if (createError) {
                            console.error("Error creating new contact from webhook:", createError.message);
                            continue;
                        }
                        contactData = newContact;
                        isNewContact = true;
                    }
                    const contact = contactData as unknown as Contact;
                    
                    // Trigger "Novo Contato"
                    if(isNewContact) {
                         for (const auto of automations) {
                            const triggerNode = auto.nodes.find(n => n.data.nodeType === 'trigger' && n.data.type === 'new_contact');
                            if (triggerNode) await executeFlow(supabase, auto, triggerNode.id, contact, metaConfig);
                        }
                    }

                    // Gatilho de Palavra-chave
                    if (message.type === 'text' && message.text?.body) {
                        await supabase.from('received_messages').insert({ user_id: profile.id, contact_id: contact.id, meta_message_id: message.id, message_body: message.text.body });
                        const messageText = message.text.body.toLowerCase().trim();
                        for (const auto of automations) {
                            const triggerNode = auto.nodes.find(n => n.data.nodeType === 'trigger' && n.data.type === 'message_received_with_keyword' && messageText.includes(((n.data.config as any)?.keyword || 'NON_EXISTENT_KEYWORD').toLowerCase().trim()));
                            if (triggerNode) await executeFlow(supabase, auto, triggerNode.id, contact, metaConfig);
                        }
                    }

                    // Gatilho de Clique em Botão
                    if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                        const buttonPayload = message.interactive.button_reply.id;
                         for (const auto of automations) {
                            const triggerNode = auto.nodes.find(n => n.data.nodeType === 'trigger' && n.data.type === 'button_clicked' && (n.data.config as any)?.button_payload === buttonPayload);
                            if (triggerNode) await executeFlow(supabase, auto, triggerNode.id, contact, metaConfig);
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
            Promise.resolve().then(() => {
                processMetaPayload(supabase, body).catch(err => console.error("Webhook: Erro durante o processamento de evento da Meta:", err.message));
            });
            return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
        }

        return new Response('Method Not Allowed', { status: 405, headers: { ...corsHeaders, 'Allow': 'GET, POST' } });
    } catch (error: any) {
        console.error('Webhook: Erro Crítico no Handler:', error);
        return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
}