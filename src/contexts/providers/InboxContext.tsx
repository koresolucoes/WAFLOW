
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
        const { data, error } = await supabase.rpc('get_conversations_with_contacts', { p_user_id: user.id });

        if (error) {
            console.error("Error fetching conversations:", error);
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
        } else if (data && Array.isArray(data)) {
            setMessages(data as unknown as UnifiedMessage[]);
        }
        
        setIsLoading(false);

    }, [user]);
    
    // Função para definir o contato ativo e zerar a contagem de não lidas localmente para feedback instantâneo.
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

            const handleDbChange = (payload: any) => {
                console.log('Realtime DB change received:', payload.eventType, payload.table);
                
                if (payload.eventType === 'INSERT') {
                    const newMessage = mapPayloadToUnifiedMessage(payload.new);
                    const contactId = newMessage.contact_id;
                    
                    // Atualiza a lista de conversas
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
                            // É uma conversa nova, recarrega a lista para obter os detalhes do contato
                            fetchConversations();
                            return prev;
                        }
                    });

                    // Adiciona a mensagem à janela de chat ativa
                    if (contactId === activeContactIdRef.current) {
                        setMessages(prev => [...prev, newMessage]);
                    }

                } else if (payload.eventType === 'UPDATE' && payload.table === 'sent_messages') {
                    const updatedMessage = mapPayloadToUnifiedMessage(payload.new);

                    // Atualiza o status na janela de chat ativa
                    if (updatedMessage.contact_id === activeContactIdRef.current) {
                        setMessages(prev => prev.map(m => (m.id === updatedMessage.id && m.sourceTable === 'sent_messages') ? updatedMessage : m));
                    }

                    // Atualiza o status na lista de conversas se for a última mensagem
                    setConversations(prev => prev.map(c => {
                        if (c.last_message?.id === updatedMessage.id && c.last_message.sourceTable === 'sent_messages') {
                            return { ...c, last_message: updatedMessage };
                        }
                        return c;
                    }));
                }
            };
            
            const channel = supabase.channel(`inbox-changes-for-user-${user.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'received_messages' }, handleDbChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sent_messages' }, handleDbChange)
                .subscribe();
            
            return () => {
                supabase.removeChannel(channel);
            }
        }
    }, [user, fetchConversations, fetchMessages]);

    const sendMessage = useCallback(async (contactId: string, text: string) => {
        if (!user) {
            throw new Error("Usuário não autenticado.");
        }
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
            throw new Error("Sessão de usuário inválida. Por favor, faça login novamente.");
        }

        const currentUserId = authData.user.id;
        
        if (!metaConfig.accessToken) throw new Error("Configuração da Meta ausente.");
        
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) throw new Error("Contato não encontrado.");
        
        setIsSending(true);
        try {
            const response = await sendTextMessage(metaConfig, contact.phone, text);
            const metaMessageId = response.messages[0].id;

            const messagePayload: SentMessageInsert = {
                user_id: currentUserId,
                contact_id: contactId,
                content: text,
                meta_message_id: metaMessageId,
                status: 'sent',
                source: 'direct'
            };
            
            // O gatilho de tempo real cuidará da atualização da UI
            const { error } = await supabase.from('sent_messages').insert(messagePayload);
            if (error) {
                // Se a inserção falhar, lança o erro para a UI tratar.
                 if (error.message.includes('violates row-level security policy')) {
                    throw new Error("Falha de permissão ao salvar a mensagem. Verifique se sua sessão não expirou.");
                 }
                throw error;
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
