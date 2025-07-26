
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
        message_template_id: payload.message_template_id,
        replied_to_message_id: payload.replied_to_message_id,
    };
};

export const fetchConversationsFromDb = async (userId: string): Promise<Conversation[]> => {
    const { data, error } = await supabase.rpc('get_conversations_with_contacts', { p_user_id: userId } as any);
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
    const { data, error } = await supabase
        .from('messages')
        .select(`
            id,
            contact_id,
            content,
            created_at,
            type,
            status,
            message_template_id,
            replied_to_message_id,
            campaigns (
                message_templates (
                    *
                )
            )
        `)
        .eq('user_id', userId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching messages directly:", error);
        throw error;
    }

    return (data as any[] || []).map((msg: any) => {
        const templateData = msg.campaigns?.message_templates;
        
        const template = templateData ? {
            ...templateData,
            category: templateData.category as TemplateCategory,
            status: templateData.status as TemplateStatus,
            components: (templateData.components as unknown as MetaTemplateComponent[]) || []
        } : null;
        
        return {
            id: msg.id,
            contact_id: msg.contact_id,
            content: msg.content,
            created_at: msg.created_at,
            type: msg.type,
            status: msg.status,
            message_template_id: msg.message_template_id,
            replied_to_message_id: msg.replied_to_message_id,
            template: template
        };
    });
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
    return data as unknown as Message;
};