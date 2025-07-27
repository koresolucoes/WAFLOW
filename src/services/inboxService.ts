import { supabase } from '../lib/supabaseClient';
import { Conversation, UnifiedMessage, Contact, MessageInsert, MessageStatus, MetaConfig, Message, TemplateCategory, TemplateStatus, MetaTemplateComponent } from '../types';
import { sendTextMessage } from './meta/messages';

export const mapPayloadToUnifiedMessage = (payload: Message): UnifiedMessage => {
    return {
        id: payload.id,
        contact_id: payload.contact_id,
        content: payload.content,
        created_at: payload.created_at,
        type: payload.type,
        status: payload.status,
        source: payload.source,
        message_template_id: payload.message_template_id,
        replied_to_message_id: payload.replied_to_message_id,
    };
};

export const fetchConversationsFromDb = async (teamId: string): Promise<Conversation[]> => {
    const { data, error } = await supabase.rpc('get_conversations_with_contacts', { p_team_id: teamId } as any);
    if (error) {
        console.error("Error fetching conversations:", error);
        throw error;
    }
    if (data && Array.isArray(data)) {
        return (data as any[]).map(item => ({
            contact: item.contact_details as Contact,
            last_message: item.last_message as UnifiedMessage,
            unread_count: item.unread_count,
            assignee_id: item.assignee_id,
            assignee_email: item.assignee_email,
        }));
    }
    return [];
};

export const fetchMessagesFromDb = async (teamId: string, contactId: string): Promise<UnifiedMessage[]> => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('team_id', teamId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching messages directly:", error);
        throw error;
    }

    return ((data as any[]) || []).map((msg) => ({
        ...msg,
        template: null, // Explicitly null as we are not fetching detailed template info here.
    }));
};


export const sendMessageToApi = async (teamId: string, contact: Contact, text: string, metaConfig: MetaConfig): Promise<Message> => {
    const response = await sendTextMessage(metaConfig, contact.phone, text);
    const metaMessageId = response.messages[0].id;

    const messagePayload: MessageInsert = { 
        team_id: teamId, 
        contact_id: contact.id, 
        content: text, 
        meta_message_id: metaMessageId, 
        status: 'sent', 
        source: 'direct',
        type: 'outbound',
        sent_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase.from('messages').insert(messagePayload as any).select().single();
    
    if (error) {
        console.error("Supabase insert error in sendMessageToApi:", error);
        throw error;
    }
     if (!data) {
        throw new Error("A mensagem foi enviada, mas falhou ao ser salva no banco de dados.");
    }
    return data as unknown as Message;
};

export const assignConversation = async (teamId: string, contactId: string, assigneeId: string | null): Promise<void> => {
    // A chamada upsert estava a falhar devido à falta de uma restrição única na tabela.
    // Substituído por um padrão manual de seleção-inserção/atualização.

    // 1. Verificar se existe um registo de conversação para este contacto e equipa.
    const { data: existingConversation, error: selectError } = await supabase
        .from('conversations')
        .select('id')
        .eq('team_id', teamId)
        .eq('contact_id', contactId)
        .maybeSingle();

    if (selectError) {
        console.error("Erro ao encontrar a conversação existente:", selectError);
        throw selectError;
    }

    if (existingConversation) {
        // 2a. Se existir uma conversação, atualizar o seu responsável.
        const { error: updateError } = await supabase
            .from('conversations')
            .update({ 
                assignee_id: assigneeId, 
                updated_at: new Date().toISOString() 
            } as any)
            .eq('id', existingConversation.id);

        if (updateError) {
            console.error("Erro ao atualizar o responsável pela conversação:", updateError);
            throw updateError;
        }
    } else {
        // 2b. Se não existir nenhuma conversação, criar uma nova.
        const { error: insertError } = await supabase
            .from('conversations')
            .insert({
                team_id: teamId,
                contact_id: contactId,
                assignee_id: assigneeId,
                status: 'open', // Definir um estado padrão para novas conversações
                updated_at: new Date().toISOString()
            } as any);

        if (insertError) {
            console.error("Erro ao inserir nova conversação:", insertError);
            throw insertError;
        }
    }
};