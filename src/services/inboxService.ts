


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
    const { data, error } = await supabase.rpc('get_conversations_with_contacts', { p_team_id: teamId });
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
    
    const { data, error } = await supabase.from('messages').insert(messagePayload).select().single();
    
    if (error) {
        console.error("Supabase insert error in sendMessageToApi:", error);
        throw error;
    }
     if (!data) {
        throw new Error("A mensagem foi enviada, mas falhou ao ser salva no banco de dados.");
    }
    return data as unknown as Message;
};