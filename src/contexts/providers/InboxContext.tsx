
import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AuthContext } from './AuthContext';
import { ContactsContext } from './ContactsContext';
import { Conversation, UnifiedMessage, Contact, SentMessageInsert, MessageStatus } from '../../types';
import { sendTextMessage } from '../../services/meta/messages';
import { Tables } from '../../types/database.types';

interface InboxContextType {
    conversations: Conversation[];
    messages: UnifiedMessage[];
    activeContactId: string | null;
    setActiveContactId: (contactId: string | null) => void;
    sendMessage: (contactId: string, text: string) => Promise<void>;
    isLoading: boolean;
    isSending: boolean;
}

export const InboxContext = createContext<InboxContextType>(null!);

// Mapeia o payload do Supabase (tabelas sent_messages ou received_messages) para o tipo unificado de mensagem.
const mapPayloadToUnifiedMessage = (payload: Tables<'sent_messages'> | Tables<'received_messages'>): UnifiedMessage => {
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


export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, metaConfig } = useContext(AuthContext);
    const { contacts } = useContext(ContactsContext);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<UnifiedMessage[]>([]);
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    const activeContactIdRef = useRef(activeContactId);
    useEffect(() => {
        activeContactIdRef.current = activeContactId;
    }, [activeContactId]);


    const fetchConversations = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const { data, error } = await supabase.rpc('get_conversations_with_contacts' as any, { p_user_id: user.id });

        if (error) {
            console.error("Error fetching conversations:", error);
            setIsLoading(false);
            return;
        }
        
        if (data && Array.isArray(data)) {
            const fetchedConversations: Conversation[] = (data as any[]).map(item => ({
                contact: item.contact_details as Contact,
                last_message: item.last_message as UnifiedMessage,
                unread_count: item.unread_count
            }));
            setConversations(fetchedConversations);
        } else {
            setConversations([]);
        }
        setIsLoading(false);
    }, [user]);
    
    const fetchMessages = useCallback(async (contactId: string | null) => {
        if (!contactId || !user) {
            setMessages([]);
            return;
        }
        setIsLoading(true);

        const { data, error } = await supabase.rpc('get_unified_message_history' as any, {
            p_user_id: user.id,
            p_contact_id: contactId
        });

        if (error) {
            console.error(`Error fetching messages for contact ${contactId}:`, error);
            setMessages([]);
        } else if (data && Array.isArray(data)) {
            setMessages(data as unknown as UnifiedMessage[]);
        }
        
        setIsLoading(false);

    }, [user]);
    
    const setActiveContactIdAndMarkRead = (contactId: string | null) => {
        setActiveContactId(contactId);
        if (contactId) {
            setConversations(prev => prev.map(c => c.contact.id === contactId ? { ...c, unread_count: 0 } : c));
        }
    };


    useEffect(() => {
        if (activeContactId) {
            fetchMessages(activeContactId);
        } else {
            setMessages([]);
        }
    }, [activeContactId, fetchMessages]);

    useEffect(() => {
        if (user) {
            fetchConversations();

            const handleNewMessage = (payload: any) => {
                const newMessage = mapPayloadToUnifiedMessage(payload.new as Tables<'sent_messages'> | Tables<'received_messages'>);
                const contactId = newMessage.contact_id;
                
                setConversations(prev => {
                    const convoIndex = prev.findIndex(c => c.contact.id === contactId);
                    if (convoIndex > -1) {
                        const updatedConvo = { 
                            ...prev[convoIndex], 
                            last_message: newMessage,
                            unread_count: (newMessage.type === 'inbound' && contactId !== activeContactIdRef.current) 
                                ? (prev[convoIndex].unread_count || 0) + 1 
                                : prev[convoIndex].unread_count
                        };
                        const otherConvos = prev.filter(c => c.contact.id !== contactId);
                        return [updatedConvo, ...otherConvos];
                    } else {
                        const contactDetails = contacts.find(c => c.id === contactId);
                        if (contactDetails) {
                             const newConvo: Conversation = { contact: contactDetails, last_message: newMessage, unread_count: 1 };
                             return [newConvo, ...prev];
                        }
                        // If contact not found in context, refetch all convos to get details
                        fetchConversations();
                        return prev;
                    }
                });

                if (contactId === activeContactIdRef.current) {
                    setMessages(prev => [...prev, newMessage]);
                }
            };

            const handleMessageUpdate = (payload: any) => {
                 const updatedMessage = mapPayloadToUnifiedMessage(payload.new as Tables<'sent_messages'> | Tables<'received_messages'>);
                 if (updatedMessage.contact_id === activeContactIdRef.current) {
                    setMessages(prev => prev.map(m => (m.id === updatedMessage.id && m.sourceTable === 'sent_messages') ? updatedMessage : m));
                 }
                 setConversations(prev => prev.map(c => (c.last_message?.id === updatedMessage.id && c.last_message.sourceTable === 'sent_messages') ? { ...c, last_message: updatedMessage } : c));
            };
            
            const receivedMessagesChannel = supabase.channel(`received-messages-${user.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'received_messages', filter: `user_id=eq.${user.id}` }, handleNewMessage)
                .subscribe();
            
            const sentMessagesChannel = supabase.channel(`sent-messages-${user.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sent_messages', filter: `user_id=eq.${user.id}` }, handleMessageUpdate)
                .subscribe();
            
            return () => {
                supabase.removeChannel(receivedMessagesChannel);
                supabase.removeChannel(sentMessagesChannel);
            }
        }
    }, [user, contacts, fetchConversations]);

    const sendMessage = useCallback(async (contactId: string, text: string) => {
        if (!user) throw new Error("Usuário não autenticado.");
        if (!metaConfig.accessToken) throw new Error("Configuração da Meta ausente.");
        
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) throw new Error("Contato não encontrado.");
        
        setIsSending(true);
        try {
            const response = await sendTextMessage(metaConfig, contact.phone, text);
            const metaMessageId = response.messages[0].id;

            const messagePayload: SentMessageInsert = { user_id: user.id, contact_id: contactId, content: text, meta_message_id: metaMessageId, status: 'sent', source: 'direct' };
            
            const { data: insertedMessage, error } = await supabase.from('sent_messages').insert(messagePayload as any).select().single();
            if (error) throw error;

            if (insertedMessage) {
                const newMessage = mapPayloadToUnifiedMessage(insertedMessage as unknown as Tables<'sent_messages'>);
                setMessages(prev => [...prev, newMessage]);
                setConversations(prev => {
                    const convoIndex = prev.findIndex(c => c.contact.id === contactId);
                    if (convoIndex > -1) {
                        const updatedConvo = { ...prev[convoIndex], last_message: newMessage, unread_count: 0 };
                        return [updatedConvo, ...prev.filter(c => c.contact.id !== contactId)];
                    } else {
                        const newConvo: Conversation = { contact, last_message: newMessage, unread_count: 0 };
                        return [newConvo, ...prev];
                    }
                });
            }
        } catch (error: any) {
            console.error("Failed to send message:", error);
            throw error;
        } finally {
            setIsSending(false);
        }
    }, [user, metaConfig, contacts]);


    const value = {
        conversations,
        messages,
        activeContactId,
        setActiveContactId: setActiveContactIdAndMarkRead,
        sendMessage,
        isLoading,
        isSending
    };

    return (
        <InboxContext.Provider value={value}>
            {children}
        </InboxContext.Provider>
    );
};
