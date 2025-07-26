import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { ContactsContext } from './ContactsContext';
import { Conversation, UnifiedMessage, Message, MessageStatus, Contact } from '../../types';
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

            const handleMessageChange = (payload: { new: Message, eventType: string }) => {
                const newMessage = inboxService.mapPayloadToUnifiedMessage(payload.new);
                const contactId = newMessage.contact_id;
                
                // Update conversation list
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
                        fetchConversations(); // Refetch if contact is not in local state
                        return prev;
                    }
                });
                
                // Update active chat window, handling optimistic updates
                if (contactId === activeContactIdRef.current) {
                    if (payload.eventType === 'INSERT') {
                        // Avoid adding duplicates from optimistic updates if the ID is already present
                        setMessages(prev => {
                            if (prev.some(m => m.id === newMessage.id)) {
                                return prev.map(m => m.id === newMessage.id ? newMessage : m);
                            }
                            return [...prev, newMessage];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setMessages(prev => prev.map(m => m.id === newMessage.id ? newMessage : m));
                    }
                }
            };
            
            const messagesChannel = supabase.channel(`messages-channel-${user.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `user_id=eq.${user.id}` }, handleMessageChange as any)
                .subscribe();
            
            return () => {
                supabase.removeChannel(messagesChannel);
            }
        }
    }, [user, contacts, fetchConversations]);

    const sendMessage = useCallback(async (contactId: string, text: string) => {
        if (!user) throw new Error("Usuário não autenticado.");
        if (!metaConfig.accessToken) throw new Error("Configuração da Meta ausente.");
        
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) throw new Error("Contato não encontrado.");
        
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMessage: UnifiedMessage = {
            id: optimisticId,
            contact_id: contactId,
            content: text,
            created_at: new Date().toISOString(),
            type: 'outbound',
            status: 'pending',
            message_template_id: null,
            replied_to_message_id: null,
        };

        setMessages(prev => [...prev, optimisticMessage]);
        
        setIsSending(true);
        try {
            const savedMessage = await inboxService.sendMessageToApi(user.id, contact, text, metaConfig);
            const unifiedSavedMessage = inboxService.mapPayloadToUnifiedMessage(savedMessage);
            
            // Replace optimistic message with the real one from DB.
            setMessages(prev => prev.map(m => m.id === optimisticId ? unifiedSavedMessage : m));

        } catch (error: any) {
            console.error("Failed to send message:", error);
             // Mark optimistic message as failed
            setMessages(prev => prev.map(m => 
                m.id === optimisticId ? { ...m, status: 'failed' } : m
            ));
            throw error; // re-throw to be caught by the UI component
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
