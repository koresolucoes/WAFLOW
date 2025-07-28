import React, { useRef, useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import Button from '../../components/common/Button';
import { INFO_ICON, NOTE_ICON, CALENDAR_ICON } from '../../components/icons';
import { UnifiedMessage } from '../../types';
import ActivityModal from './ActivityModal';

interface ChatWindowProps {
    isPanelOpen: boolean;
    setIsPanelOpen: (isOpen: boolean) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isPanelOpen, setIsPanelOpen }) => {
    const { messages, activeContactId, inboxLoading, contacts } = useAuthStore();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [activityModal, setActivityModal] = useState<{isOpen: boolean; type: 'NOTA' | 'TAREFA' | null}>({isOpen: false, type: null});

    const activeContact = contacts.find(c => c.id === activeContactId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    if (!activeContact) {
        return <div className="flex-1 bg-slate-900" />;
    }
    
    const handleOpenActivityModal = (type: 'NOTA' | 'TAREFA') => {
        setActivityModal({ isOpen: true, type });
    };

    const handleCloseActivityModal = () => {
        setActivityModal({ isOpen: false, type: null });
    };


    return (
        <>
            <section className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
                <header className="flex-shrink-0 flex items-center p-3 border-b border-slate-700/50 bg-slate-800">
                    <img
                        className="h-10 w-10 rounded-full object-cover"
                        src={`https://api.dicebear.com/8.x/initials/svg?seed=${activeContact.name}`}
                        alt="Avatar"
                    />
                    <div className="ml-3">
                        <h2 className="font-semibold text-white">{activeContact.name}</h2>
                        <p className="text-sm text-slate-400 font-mono">{activeContact.phone}</p>
                    </div>
                     <div className="ml-auto flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenActivityModal('NOTA')} title="Adicionar Nota" className="rounded-full w-10 h-10">
                            <NOTE_ICON className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenActivityModal('TAREFA')} title="Adicionar Tarefa" className="rounded-full w-10 h-10">
                            <CALENDAR_ICON className="w-5 h-5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsPanelOpen(!isPanelOpen)}
                            className={`rounded-full w-10 h-10 ${isPanelOpen ? 'bg-slate-700' : ''}`}
                            title={isPanelOpen ? 'Ocultar Detalhes' : 'Mostrar Detalhes'}
                        >
                            <INFO_ICON className="w-5 h-5" />
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0a1014] bg-[url('https://www.heroscreen.cc/static/media/whats-app-dark-bg.a5027f2f.png')] bg-cover">
                    <div className="space-y-4">
                        {inboxLoading ? (
                            <div className="text-center text-slate-400">Carregando mensagens...</div>
                        ) : (
                            messages.map((msg: UnifiedMessage) => (
                                <MessageBubble key={msg.id} message={msg} />
                            ))
                        )}
                    </div>
                    <div ref={messagesEndRef} />
                </div>

                <MessageInput contactId={activeContact.id} />
            </section>
             {activityModal.isOpen && activeContact && (
                 <ActivityModal
                    isOpen={activityModal.isOpen}
                    onClose={handleCloseActivityModal}
                    type={activityModal.type!}
                    contactId={activeContact.id}
                />
            )}
        </>
    );
};

export default ChatWindow;