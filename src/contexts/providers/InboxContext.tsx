

import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AuthContext } from './AuthContext';
import { ContactsContext } from './ContactsContext';
import { Conversation, UnifiedMessage, Contact, SentMessageInsert } from '../../types';
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

export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, metaConfig } = useContext(AuthContext);
    const { contacts } = useContext(ContactsContext);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<UnifiedMessage[]>([]);
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const fetchConversations = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);

        const { data, error } = await supabase.rpc('get_conversations_with_contacts', { p_user_id: user.id });

        if (error) {
            console.error("Error fetching conversations:", error);
            setIsLoading(false);
            return;
        }
        
        if (data && Array.isArray(data)) {
            // CORREÇÃO: Mapeia corretamente a estrutura retornada pelo RPC.
            // O objeto 'last_message' já vem completo e aninhado.
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

        const { data, error } = await supabase.rpc('get_unified_message_history', {
            p_user_id: user.id,
            p_contact_id: contactId
        });

        if (error) {
            console.error(`Error fetching messages for contact ${contactId}:`, error);
            setMessages([]);
        } else if (data) {
            setMessages(data as unknown as UnifiedMessage[]);
        }
        
        setIsLoading(false);

    }, [user]);

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

            const channel = supabase.channel(`inbox-${user.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'received_messages' }, payload => {
                    console.log('Realtime new received message', payload);
                    fetchConversations();
                    if((payload.new as Tables<'received_messages'>).contact_id === activeContactId){
                         fetchMessages(activeContactId);
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sent_messages' }, payload => {
                    console.log('Realtime sent message change', payload);
                    fetchConversations();
                    if((payload.new as Tables<'sent_messages'>).contact_id === activeContactId){
                         fetchMessages(activeContactId);
                    }
                })
                .subscribe();
            
            return () => {
                supabase.removeChannel(channel);
            }
        }
    }, [user, fetchConversations, fetchMessages, activeContactId]);

    const sendMessage = useCallback(async (contactId: string, text: string) => {
        if (!user || !metaConfig.accessToken) throw new Error("Usuário ou configuração da Meta ausente.");
        
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) throw new Error("Contato não encontrado.");
        
        setIsSending(true);
        try {
            const response = await sendTextMessage(metaConfig, contact.phone, text);
            const metaMessageId = response.messages[0].id;

            const messagePayload: SentMessageInsert = {
                user_id: user.id,
                contact_id: contactId,
                content: text,
                meta_message_id: metaMessageId,
                status: 'sent',
                source: 'direct'
            };
            
            const { error } = await supabase.from('sent_messages').insert(messagePayload);
            if (error) throw error;
            
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
        setActiveContactId,
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