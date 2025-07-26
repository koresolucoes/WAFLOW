import { supabase } from '../lib/supabaseClient';
import { Conversation, UnifiedMessage, Contact, MessageInsert, MessageStatus, MetaConfig, Message } from '../types';
import { sendTextMessage } from './meta/messages';

export const mapPayloadToUnifiedMessage = (payload: Message): UnifiedMessage => {
    return {
        id: payload.id,
        contact_id: payload.contact_id,
        content: payload.content,
        created_at: payload.created_at,
        type: payload.type,
        status: payload.status,
        // Mantém a compatibilidade com a lógica de UI existente
        sourceTable: payload.type === 'inbound' ? 'received_messages' : 'sent_messages', 
    };
};

export const fetchConversationsFromDb = async (userId: string): Promise<Conversation[]> => {
    const { data, error } = await supabase.rpc('get_conversations_with_contacts', { p_user_id: userId });
    if (error) {
        console.error("Error fetching conversations:", error);
        throw error;
    }
    if (data && Array.isArray(data)) {
        return (data as any[]).map(item => ({
            contact: item.contact_details as Contact,
            last_message: item.last_message as UnifiedMessage,
            unread_count: item.unread_count
        }));
    }
    return [];
};

export const fetchMessagesFromDb = async (userId: string, contactId: string): Promise<UnifiedMessage[]> => {
    const { data, error } = await supabase.rpc('get_unified_message_history', {
        p_user_id: userId,
        p_contact_id: contactId
    });
    if (error) throw error;
    return (data as any as UnifiedMessage[]) || [];
};

export const sendMessageToApi = async (userId: string, contact: Contact, text: string, metaConfig: MetaConfig): Promise<Message> => {
    const response = await sendTextMessage(metaConfig, contact.phone, text);
    const metaMessageId = response.messages[0].id;

    const messagePayload: MessageInsert = { 
        user_id: userId, 
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
    return data as Message;
};
