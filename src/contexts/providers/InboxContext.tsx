


import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { ContactsContext } from './ContactsContext';
import { Conversation, UnifiedMessage, Contact, MessageStatus, Tables } from '../../types';
import * as inboxService from '../../services/inboxService';

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
    const user = useAuthStore(state => state.user);
    const metaConfig = useMetaConfig();
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
        try {
            const data = await inboxService.fetchConversationsFromDb(user.id);
            setConversations(data);
        } catch (error) {
            console.error("Error fetching conversations:", error);
            setConversations([]);
        } finally {
            setIsLoading(false);
        }
    }, [user]);
    
    const fetchMessages = useCallback(async (contactId: string | null) => {
        if (!contactId || !user) {
            setMessages([]);
            return;
        }
        setIsLoading(true);
        try {
            const data = await inboxService.fetchMessagesFromDb(user.id, contactId);
            setMessages(data);
        } catch (error) {
            console.error(`Error fetching messages for contact ${contactId}:`, error);
            setMessages([]);
        } finally {
            setIsLoading(false);
        }

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
                const newMessage = inboxService.mapPayloadToUnifiedMessage(payload.new as Tables<'sent_messages'> | Tables<'received_messages'>);
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
                 const updatedMessage = inboxService.mapPayloadToUnifiedMessage(payload.new as Tables<'sent_messages'> | Tables<'received_messages'>);
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
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sent_messages', filter: `user_id=eq.${user.id}` }, handleNewMessage)
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
            await inboxService.sendMessageToApi(user.id, contact, text, metaConfig);
            // Realtime will handle the update
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