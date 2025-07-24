import { supabase } from '../lib/supabaseClient';
import { Conversation, UnifiedMessage, Contact, SentMessageInsert, MessageStatus, MetaConfig, Tables } from '../types';
import { sendTextMessage } from './meta/messages';

export const mapPayloadToUnifiedMessage = (payload: Tables<'sent_messages'> | Tables<'received_messages'>): UnifiedMessage => {
    const isReceived = 'message_body' in payload;
    return {
        id: payload.id,
        contact_id: payload.contact_id,
        content: isReceived ? (payload.message_body || '') : (payload as Tables<'sent_messages'>).content,
        created_at: isReceived ? payload.received_at : (payload as Tables<'sent_messages'>).created_at,
        type: isReceived ? 'inbound' : 'outbound',
        status: !isReceived ? (payload as Tables<'sent_messages'>).status as MessageStatus : undefined,
        sourceTable: isReceived ? 'received_messages' : 'sent_messages',
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
    return (data as UnifiedMessage[]) || [];
};

export const sendMessageToApi = async (userId: string, contact: Contact, text: string, metaConfig: MetaConfig) => {
    const response = await sendTextMessage(metaConfig, contact.phone, text);
    const metaMessageId = response.messages[0].id;

    const messagePayload: SentMessageInsert = { 
        user_id: userId, 
        contact_id: contact.id, 
        content: text, 
        meta_message_id: metaMessageId, 
        status: 'sent', 
        source: 'direct' 
    };
    
    const { error } = await supabase.from('sent_messages').insert(messagePayload);
    if (error) throw error;
};