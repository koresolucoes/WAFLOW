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
    // Step 1: Call the existing RPC to get the main conversation structure (last message, contact details, etc.)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_conversations_with_contacts', { p_team_id: teamId } as any);

    if (rpcError) {
        console.error("Error fetching conversations via RPC:", rpcError);
        throw rpcError;
    }

    // Step 2: Fetch the latest assignment data directly from the `conversations` table.
    // This acts as a patch to ensure assignment data is always fresh, even if the RPC is stale.
    const { data: assignmentData, error: assignmentError } = await supabase
        .from('conversations')
        .select('contact_id, assignee_id')
        .eq('team_id', teamId);

    if (assignmentError) {
        console.error("Error fetching conversation assignments, assignee data might be stale:", assignmentError);
        // We can continue with just the RPC data if this fails, so we don't throw an error.
    }

    // Create a map for quick lookups of the fresh assignment data.
    const assignmentMap = new Map<string, string | null>();
    if (assignmentData) {
        for (const assignment of assignmentData) {
            assignmentMap.set(assignment.contact_id, assignment.assignee_id);
        }
    }
    
    if (rpcData && Array.isArray(rpcData)) {
        return (rpcData as any[]).map(item => {
            const contactId = item.contact_details?.id;
            const freshAssigneeId = contactId !== undefined ? (assignmentMap.get(String(contactId)) ?? null) : null;

            return {
                contact: item.contact_details as Contact,
                last_message: item.last_message as UnifiedMessage,
                unread_count: item.unread_count,
                // Use the fresh assignee_id from our direct query. Fallback to RPC data if not found.
                assignee_id: freshAssigneeId,
                // The email will be correctly mapped in the authStore using the fresh assignee_id.
                assignee_email: item.assignee_email as string | null, 
            };
        });
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

export const assignConversation = async (contactId: string, assigneeId: string | null): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contactId, assigneeId }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign conversation');
    }
};

export const deleteConversation = async (contactId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch(`/api/conversation?contactId=${contactId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete conversation');
    }
};