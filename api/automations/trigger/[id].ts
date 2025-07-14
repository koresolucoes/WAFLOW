// /api/automations/trigger/[id].ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables, Json, TablesInsert } from '../../../src/types/database.types';
import { Automation, Contact, AutomationNode, MessageTemplate } from '../../../src/types';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// Helper Functions
// ============================================================================

const getValueFromPath = (obj: any, path: string) => {
    if (!path) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}


// ============================================================================
// Flow Execution Engine (Copied from /api/webhook.ts for serverless isolation)
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

async function sendWhatsAppTextMessage(metaConfig: any, to: string, text: string) {
    return sendWhatsAppRequest(metaConfig, to, { type: 'text', text: { body: text } });
}

async function sendWhatsAppTemplate(metaConfig: any, to: string, template: MessageTemplate, contact: Contact) {
    const parameters = (template.components?.find(c => c.type === 'BODY')?.text?.match(/\{\{1\}\}/g) || []).map(() => ({ type: 'text', text: contact.name }));
    const components = parameters.length > 0 ? [{ type: 'body', parameters }] : [];
    return sendWhatsAppRequest(metaConfig, to, {
        type: 'template',
        template: { name: template.template_name, language: { code: 'pt_BR' }, components }
    });
}

async function sendWhatsAppMedia(metaConfig: any, to: string, config: any) {
    const mediaPayload: any = { type: config.media_type };
    mediaPayload[config.media_type] = { link: config.media_url, caption: config.caption };
    return sendWhatsAppRequest(metaConfig, to, mediaPayload);
}

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

async function evaluateCondition(node: AutomationNode, contact: Contact): Promise<boolean> {
    const config = node.data.config as any;
    if (!config.field || !config.operator) return false;

    let contactValue: any;
    if (config.field === 'tags') {
        contactValue = contact.tags || [];
    } else if (config.field === 'name') {
        contactValue = contact.name || '';
    } else if (config.field === 'custom_fields') {
        contactValue = (contact.custom_fields as any)?.[config.custom_field_name] ?? '';
    } else {
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


async function executeActionNode(supabase: SupabaseClient<Database>, node: AutomationNode, contact: Contact, metaConfig: any) {
    const actionType = node.data.type;
    const actionConfig = node.data.config as any;
    let details = `Ação '${actionType}' executada.`;
    try {
        switch(actionType) {
            case 'send_template':
                if (!actionConfig.template_id) throw new Error("ID do template não configurado.");
                const { data: tpl } = await supabase.from('message_templates').select('*').eq('id', actionConfig.template_id).single();
                if (!tpl) throw new Error("Template não encontrado.");
                if ((tpl as MessageTemplate).status !== 'APPROVED') throw new Error(`Template não APROVADO.`);
                await sendWhatsAppTemplate(metaConfig, contact.phone, tpl as MessageTemplate, contact);
                break;
            case 'add_tag':
                if (!actionConfig.tag) throw new Error("Tag não configurada.");
                const newTags = [...new Set([...(contact.tags || []), actionConfig.tag])];
                await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
                break;
            case 'remove_tag':
                if (!actionConfig.tag) throw new Error("Tag não configurada.");
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
                await sendWhatsAppTextMessage(metaConfig, contact.phone, actionConfig.message_text.replace(/\{\{contact\.name\}\}/g, contact.name || ''));
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
                } else break;
            } else if (nodeType === 'logic') {
                if (currentNode.data.type === 'condition') {
                    const conditionResult = await evaluateCondition(currentNode, contact);
                    const edge = automation.edges.find(e => e.source === currentNodeId && e.sourceHandle === (conditionResult ? 'yes' : 'no'));
                    if (edge) queue.push(edge.target);
                } else if (currentNode.data.type === 'split_path') {
                    const edge = automation.edges.find(e => e.source === currentNodeId && e.sourceHandle === (Math.random() < 0.5 ? 'a' : 'b'));
                    if (edge) queue.push(edge.target);
                }
            }
        } catch (error: any) {
            console.error(`Erro no nó ${currentNodeId}:`, error.message);
            await supabase.from('automation_runs').insert({ automation_id: automation.id, contact_id: contact.id, status: 'failed', details: `Erro no nó ${currentNode.data.label}: ${error.message}`});
            break;
        }
    }
}

async function processWebhookPayload(
    supabase: SupabaseClient<Database>,
    payload: any,
    triggerNode: AutomationNode,
    user_id: string
): Promise<Contact> {
    const config = triggerNode.data.config as any || {};
    const dataMapping: {source: string, destination: string, destination_key?: string}[] = config.data_mapping || [];

    let phone = '';
    let name = '';
    const customFieldsToUpdate: any = {};
    const tagsToAdd: string[] = [];

    if (dataMapping.length > 0) {
        const phoneMap = dataMapping.find(m => m.destination === 'phone');
        if (phoneMap) phone = getValueFromPath(payload, phoneMap.source);

        const nameMap = dataMapping.find(m => m.destination === 'name');
        if (nameMap) name = getValueFromPath(payload, nameMap.source) || '';
        
        dataMapping.forEach(map => {
            const value = getValueFromPath(payload, map.source);
            if (value === undefined || value === null) return;

            if (map.destination === 'custom_field' && map.destination_key) {
                customFieldsToUpdate[map.destination_key] = value;
            } else if (map.destination === 'tag') {
                tagsToAdd.push(String(value));
            }
        });
    } else {
        phone = payload.phone;
        name = payload.name || '';
        Object.keys(payload)
            .filter(key => key !== 'phone' && key !== 'name')
            .forEach(key => customFieldsToUpdate[key] = payload[key]);
    }
    
    if (!phone) throw new Error('Número de telefone não encontrado no payload ou no mapeamento. Configure o mapeamento do campo de telefone.');

    const sanitizedPhone = String(phone).replace(/\D/g, '');
    let { data: contact } = await supabase.from('contacts').select('*').eq('user_id', user_id).eq('phone', sanitizedPhone).single();

    if (contact) {
        const updatedContact = {
            name: name || contact.name,
            custom_fields: { ...(contact.custom_fields as object || {}), ...customFieldsToUpdate },
            tags: [...new Set([...(contact.tags || []), ...tagsToAdd])]
        };
        const { data: updated, error } = await supabase.from('contacts').update(updatedContact).eq('id', contact.id).select().single();
        if (error) throw error;
        return updated as Contact;
    } else {
        const { data: newContact, error } = await supabase.from('contacts').insert({
            user_id: user_id,
            phone: sanitizedPhone,
            name: name || sanitizedPhone,
            custom_fields: customFieldsToUpdate,
            tags: tagsToAdd
        } as TablesInsert<'contacts'>).select().single();
        if (error) throw error;
        return newContact as Contact;
    }
}


// ============================================================================
// Main Handler
// ============================================================================
export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    const errorResponse = (msg: string, status: number = 500) => new Response(JSON.stringify({ message: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return errorResponse('Variáveis de ambiente do Supabase não configuradas.');
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    try {
        const url = new URL(req.url);
        const compositeId = url.pathname.split('/').pop();
        if (!compositeId || !compositeId.includes('_')) return errorResponse('ID do gatilho de webhook inválido ou malformado.', 400);

        const [prefix, nodeId] = compositeId.split(/_(.*)/s);
        if (!prefix || !nodeId) return errorResponse('ID do gatilho de webhook inválido.', 400);

        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('webhook_path_prefix', prefix).single();
        if (profileError || !profile) return errorResponse('Prefixo de webhook não encontrado ou inválido.', 404);

        const { data: automationData, error: autoError } = await supabase
            .from('automations')
            .select('*, nodes:nodes, edges:edges')
            .eq('user_id', profile.id)
            .eq('status', 'active')
            .filter('nodes', 'cs', `[{"id":"${nodeId}"}]`)
            .single();

        if (autoError || !automationData) return errorResponse('Automação não encontrada, inativa ou não contém o nó de webhook especificado.', 404);

        const automation = automationData as unknown as Automation;
        const triggerNode = automation.nodes.find(n => n.id === nodeId && n.data.type === 'webhook_received');
        if (!triggerNode) return errorResponse('Nó de gatilho de webhook não encontrado na automação.', 404);

        const configuredMethod = (triggerNode.data.config as any)?.method || 'POST';
        if (req.method !== configuredMethod) {
            return new Response(`Método ${req.method} não permitido. Use ${configuredMethod}.`, { status: 405, headers: { ...corsHeaders, 'Allow': configuredMethod } });
        }

        let payload: any = {};
        if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
             try {
                payload = await req.json();
            } catch {
                return errorResponse('Corpo da requisição JSON inválido.', 400);
            }
        } else if (req.method === 'GET') {
            payload = Object.fromEntries(url.searchParams.entries());
        }
        
        const needsCapture = !(triggerNode.data.config as any)?.last_captured_data;
        if (needsCapture) {
            const updatedNodes = automation.nodes.map(n => {
                if (n.id === nodeId) {
                    return { ...n, data: { ...n.data, config: { ...(n.data.config as any), last_captured_data: payload } } };
                }
                return n;
            });
            await supabase.from('automations').update({ nodes: updatedNodes as unknown as Json }).eq('id', automation.id);
            return new Response(JSON.stringify({ message: 'Dados capturados com sucesso. O webhook agora está ativo e irá executar a automação nas próximas requisições.' }), { status: 200, headers: corsHeaders });
        }

        const contact = await processWebhookPayload(supabase, payload, triggerNode, automation.user_id);
        
        const metaConfig = {
            meta_access_token: profile.meta_access_token,
            meta_phone_number_id: profile.meta_phone_number_id,
        };
        
        Promise.resolve().then(() => {
            executeFlow(supabase, automation, triggerNode.id, contact as Contact, metaConfig)
                .catch(err => console.error(`Webhook Trigger: Erro durante execução do fluxo ${automation.id}:`, err.message));
        });

        return new Response(JSON.stringify({ message: 'Webhook recebido e automação iniciada.' }), { status: 202, headers: corsHeaders });

    } catch (error: any) {
        console.error('Webhook Trigger: Erro Crítico:', error);
        return errorResponse(error.message || 'Erro interno do servidor.', 500);
    }
}