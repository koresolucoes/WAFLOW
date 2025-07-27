import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore, useMetaConfig } from '../../stores/authStore';
import { ContactsContext } from './ContactsContext';
import { Conversation, UnifiedMessage, Message, MessageStatus, Contact, TeamMemberWithEmail } from '../../types';
import * as inboxService from '../../services/inboxService';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface InboxContextType {
    conversations: Conversation[];
    messages: UnifiedMessage[];
    activeContactId: string | null;
    teamMembers: TeamMemberWithEmail[];
    setActiveContactId: (contactId: string | null) => void;
    sendMessage: (contactId: string, text: string) => Promise<void>;
    assignConversation: (contactId: string, assigneeId: string | null) => Promise<void>;
    isLoading: boolean;
    isSending: boolean;
}

export const InboxContext = createContext<InboxContextType>(null!);

export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam, allTeamMembers } = useAuthStore();
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

    const contactsRef = useRef(contacts);
    useEffect(() => {
        contactsRef.current = contacts;
    }, [contacts]);
    
    const teamMembers = useMemo(() => {
        if (!activeTeam) return [];
        return allTeamMembers.filter(m => m.team_id === activeTeam.id);
    }, [allTeamMembers, activeTeam]);


    const fetchConversations = useCallback(async () => {
        if (!user || !activeTeam) return;
        setIsLoading(true);
        try {
            const data = await inboxService.fetchConversationsFromDb(activeTeam.id);
            setConversations(data);
        } catch (error) {
            console.error("Error fetching conversations:", error);
            setConversations([]);
        } finally {
            setIsLoading(false);
        }
    }, [user, activeTeam]);
    
    const fetchMessages = useCallback(async (contactId: string | null) => {
        if (!contactId || !user || !activeTeam) {
            setMessages([]);
            return;
        }
        setIsLoading(true);
        try {
            const data = await inboxService.fetchMessagesFromDb(activeTeam.id, contactId);
            setMessages(data);
        } catch (error) {
            console.error(`Error fetching messages for contact ${contactId}:`, error);
            setMessages([]);
        } finally {
            setIsLoading(false);
        }

    }, [user, activeTeam]);
    
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
        if (user && activeTeam) {
            fetchConversations();

            const handleMessageChange = (payload: RealtimePostgresChangesPayload<{[key: string]: any}>) => {
                if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;

                const newMessage = inboxService.mapPayloadToUnifiedMessage(payload.new as Message);
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
                        const contactDetails = contactsRef.current.find(c => c.id === contactId);
                        if (contactDetails) {
                             const newConvo: Conversation = { contact: contactDetails, last_message: newMessage, unread_count: 1, assignee_id: null, assignee_email: null };
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

            const handleContactChange = (payload: RealtimePostgresChangesPayload<{[key: string]: any}>) => {
                if (payload.eventType !== 'UPDATE') return;
                const updatedContact = payload.new as Contact;
                console.log('[Inbox] Realtime contact update received:', updatedContact);
                setConversations(prev =>
                    prev.map(c =>
                        c.contact.id === updatedContact.id
                            ? { ...c, contact: updatedContact }
                            : c
                    )
                );
            };

            const handleConversationChange = (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
                if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
                const updatedConversation = payload.new as { contact_id: string; assignee_id: string | null; };
                const updatedAssigneeId = updatedConversation.assignee_id;
                const contactId = updatedConversation.contact_id;
                
                const assigneeEmail = teamMembers.find(m => m.user_id === updatedAssigneeId)?.email || null;

                setConversations(prev =>
                    prev.map(c =>
                        c.contact.id === contactId
                            ? { ...c, assignee_id: updatedAssigneeId, assignee_email: assigneeEmail }
                            : c
                    )
                );
            };
            
            const messagesChannel = supabase.channel(`messages-channel-${activeTeam.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `team_id=eq.${activeTeam.id}` }, handleMessageChange)
                .subscribe();
            
            const contactsChannel = supabase.channel(`contacts-channel-inbox-${activeTeam.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts', filter: `team_id=eq.${activeTeam.id}` }, handleContactChange)
                .subscribe();
            
            const conversationsChannel = supabase.channel(`conversations-channel-${activeTeam.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `team_id=eq.${activeTeam.id}` }, handleConversationChange)
                .subscribe();

            return () => {
                supabase.removeChannel(messagesChannel);
                supabase.removeChannel(contactsChannel);
                supabase.removeChannel(conversationsChannel);
            }
        }
    }, [user, activeTeam, fetchConversations, teamMembers]);

    const sendMessage = useCallback(async (contactId: string, text: string) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
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
            source: 'direct',
            message_template_id: null,
            replied_to_message_id: null,
        };

        setMessages(prev => [...prev, optimisticMessage]);
        
        setIsSending(true);
        try {
            const savedMessage = await inboxService.sendMessageToApi(activeTeam.id, contact, text, metaConfig);
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
    }, [user, activeTeam, metaConfig, contacts]);
    
    const assignConversation = useCallback(async (contactId: string, assigneeId: string | null) => {
        if (!activeTeam) throw new Error("No active team selected.");

        // Optimistic UI update for instant feedback
        const assigneeEmail = teamMembers.find(m => m.user_id === assigneeId)?.email || null;
        setConversations(prev =>
            prev.map(c =>
                c.contact.id === contactId
                    ? { ...c, assignee_id: assigneeId, assignee_email: assigneeEmail }
                    : c
            )
        );

        try {
            await inboxService.assignConversation(activeTeam.id, contactId, assigneeId);
            // On success, the real-time listener will eventually confirm the change, overwriting the optimistic one.
        } catch (error) {
            console.error("Failed to assign conversation, reverting via refetch.", error);
            // Revert on error by refetching the source of truth.
            fetchConversations();
            // Rethrow the error so the calling component can notify the user.
            throw error;
        }
    }, [activeTeam, teamMembers, fetchConversations]);


    const value = {
        conversations,
        messages,
        activeContactId,
        teamMembers,
        setActiveContactId: setActiveContactIdAndMarkRead,
        sendMessage,
        assignConversation,
        isLoading,
        isSending
    };

    return (
        <InboxContext.Provider value={value}>
            {children}
        </InboxContext.Provider>
    );
};