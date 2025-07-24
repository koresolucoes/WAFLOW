
import { supabaseAdmin } from '../supabaseAdmin.js';
import { executeAutomation, createDefaultLoggingHooks } from './engine.js';
import { Automation, Contact, Json, Profile, Tables } from '../types.js';
import { sanitizeAutomation } from './utils.js';

type TriggerInfo = {
    automation_id: string;
    node_id: string;
};

const dispatchAutomations = async (userId: string, triggers: TriggerInfo[], contact: Contact | null, triggerPayload: Json | null) => {
    if (triggers.length === 0) return;

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (profileError || !profile) {
        console.error(`[DISPATCHER] Erro: Perfil não encontrado para o usuário ${userId}.`, profileError);
        return;
    }

    const uniqueAutomationIds = [...new Set(triggers.map(t => t.automation_id))];

    const { data: automations, error } = await supabaseAdmin
        .from('automations')
        .select('*')
        .in('id', uniqueAutomationIds);

    if (error) {
        console.error(`[DISPATCHER] Erro: Falha ao buscar automações.`, error);
        return;
    }
    
    const automationsMap = new Map((automations as unknown as Automation[]).map(a => [a.id, a]));

    const executionPromises = triggers.map(trigger => {
        const rawAutomation = automationsMap.get(trigger.automation_id);
        if (rawAutomation) {
            // VERIFICAÇÃO CRÍTICA DO STATUS
            if (rawAutomation.status !== 'active') {
                console.log(`[DISPATCHER] Ignorando automação '${rawAutomation.name}' (ID: ${rawAutomation.id}) pois está com status '${rawAutomation.status}'.`);
                return Promise.resolve();
            }
            const automation = sanitizeAutomation(rawAutomation);
            console.log(`[DISPATCHER] Despachando automação '${automation.name}' (ID: ${automation.id}) a partir do nó ${trigger.node_id}`);
            const hooks = createDefaultLoggingHooks(automation.id, contact ? contact.id : null);
            return executeAutomation(automation, contact, trigger.node_id, triggerPayload, hooks, profile as unknown as Profile);
        }
        return Promise.resolve();
    });

    await Promise.all(executionPromises);
};

const handleMetaMessageEvent = async (userId: string, contact: Contact, message: any) => {
    const messageBody = message.type === 'text' 
        ? message.text.body.toLowerCase() 
        : '';
    const buttonPayload = message.type === 'interactive' && message.interactive.type === 'button_reply' 
        ? message.interactive.button_reply.id 
        : undefined;

    const matchingTriggers: TriggerInfo[] = [];

    if (buttonPayload) {
        const { data: buttonTriggers, error } = await supabaseAdmin
            .from('automation_triggers')
            .select('*')
            .eq('user_id', userId)
            .eq('trigger_type', 'button_clicked')
            .eq('trigger_key', buttonPayload);
        
        if (error) console.error("[HANDLER] Erro ao buscar gatilhos de botão:", error);
        else if (buttonTriggers) matchingTriggers.push(...(buttonTriggers as unknown as TriggerInfo[]));
    }

    if (messageBody) {
        const { data: allKeywordTriggers, error } = await supabaseAdmin
            .from('automation_triggers')
            .select('*')
            .eq('user_id', userId)
            .eq('trigger_type', 'message_received_with_keyword');

        if (error) {
            console.error("[HANDLER] Erro ao buscar gatilhos de palavra-chave:", error);
        } else if (allKeywordTriggers) {
            console.log(`[HANDLER] Verificando ${allKeywordTriggers.length} gatilhos de palavra-chave para a mensagem: "${messageBody}"`);
            for (const trigger of allKeywordTriggers) {
                const triggerTyped = trigger as Tables<'automation_triggers'>;
                if (triggerTyped.trigger_key && typeof triggerTyped.trigger_key === 'string' && messageBody.includes(triggerTyped.trigger_key.toLowerCase())) {
                    console.log(`[HANDLER] Correspondência encontrada! Palavra-chave: "${triggerTyped.trigger_key}". Despachando automação ${triggerTyped.automation_id}`);
                    matchingTriggers.push({ automation_id: triggerTyped.automation_id, node_id: triggerTyped.node_id });
                }
            }
        }
    }
    
    if (matchingTriggers.length > 0) {
       const triggerData = { type: 'meta_message', payload: message };
       await dispatchAutomations(userId, matchingTriggers, contact, triggerData);
    }
};

const handleNewContactEvent = async (userId: string, contact: Contact) => {
    const { data: triggers, error } = await supabaseAdmin
        .from('automation_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', 'new_contact');
        
    if (error) {
        console.error(`[HANDLER] Erro em NewContactEvent:`, error);
        return;
    }

    if (triggers && triggers.length > 0) {
        const triggerData = { type: 'new_contact', payload: { contact } };
        await dispatchAutomations(userId, triggers as unknown as TriggerInfo[], contact, triggerData);
    }
};

export const handleTagAddedEvent = async (userId: string, contact: Contact, addedTag: string) => {
    const { data: triggers, error } = await supabaseAdmin
        .from('automation_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', 'new_contact_with_tag')
        .ilike('trigger_key', addedTag);
        
    if (error) {
        console.error(`[HANDLER] Erro em TagAddedEvent:`, error);
        return;
    }
    
    if (triggers && triggers.length > 0) {
        const triggerData = { type: 'tag_added', payload: { contact, addedTag } };
        await dispatchAutomations(userId, triggers as unknown as TriggerInfo[], contact, triggerData);
    }
};

export const publishEvent = async (eventType: string, userId: string, data: any) => {
    console.log(`[EVENT BUS] Publicando evento: ${eventType} para o usuário ${userId}`);
    try {
        switch (eventType) {
            case 'message_received':
                await handleMetaMessageEvent(userId, data.contact, data.message);
                break;
            case 'contact_created':
                await handleNewContactEvent(userId, data.contact);
                break;
            case 'tag_added':
                await handleTagAddedEvent(userId, data.contact, data.tag);
                break;
            default:
                console.warn(`[EVENT BUS] Tipo de evento desconhecido: ${eventType}`);
        }
    } catch (error) {
        console.error(`[EVENT BUS] Erro ao processar o evento ${eventType}:`, error);
    }
};
