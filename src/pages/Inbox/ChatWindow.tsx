import React, { useContext, useRef, useEffect } from 'react';
import { InboxContext } from '../../contexts/providers/InboxContext';
import { ContactsContext } from '../../contexts/providers/ContactsContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import Button from '../../components/common/Button';
import { INFO_ICON } from '../../components/icons';
import { UnifiedMessage } from '../../types';

interface ChatWindowProps {
    isPanelOpen: boolean;
    setIsPanelOpen: (isOpen: boolean) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isPanelOpen, setIsPanelOpen }) => {
    const { messages, activeContactId, isLoading } = useContext(InboxContext);
    const { contacts } = useContext(ContactsContext);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeContact = contacts.find(c => c.id === activeContactId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    if (!activeContact) {
        return <div className="flex-1 bg-slate-900" />;
    }

    return (
        <section className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            <header className="flex-shrink-0 flex items-center p-3 border-b border-slate-700/50 bg-slate-800/50">
                <img
                    className="h-10 w-10 rounded-full object-cover"
                    src={`https://api.dicebear.com/8.x/initials/svg?seed=${activeContact.name}`}
                    alt="Avatar"
                />
                <div className="ml-3">
                    <h2 className="font-semibold text-white">{activeContact.name}</h2>
                    <p className="text-sm text-slate-400 font-mono">{activeContact.phone}</p>
                </div>
                 <div className="ml-auto">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsPanelOpen(!isPanelOpen)}
                        className={`${isPanelOpen ? 'bg-slate-700' : ''}`}
                        title={isPanelOpen ? 'Ocultar Detalhes' : 'Mostrar Detalhes'}
                    >
                        <INFO_ICON className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0a1014] bg-[url('https://theabbie.github.io/blog/assets/images/posts/21-03-31-whatsapp-bg-dark.png')] bg-cover">
                <div className="space-y-4">
                    {isLoading ? (
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
    );
};

export default ChatWindow;