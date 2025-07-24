
import React, { useContext } from 'react';
import { InboxContext } from '../../contexts/providers/InboxContext';
import { Conversation } from '../../types';

const ConversationListItem: React.FC<{ conversation: Conversation; isActive: boolean; onClick: () => void; }> = ({ conversation, isActive, onClick }) => {
    
    const truncate = (text: string | null | undefined, length: number) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    };

    const formatTime = (dateString: string | null | undefined) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return ''; // Retorna string vazia para datas inválidas
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (date >= startOfToday) {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else {
             return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
    }

    return (
        <li
            onClick={onClick}
            className={`flex items-center p-3 cursor-pointer transition-colors duration-150 ${isActive ? 'bg-slate-700/80' : 'hover:bg-slate-800'}`}
        >
            <img
                className="h-11 w-11 rounded-full object-cover flex-shrink-0"
                src={`https://api.dicebear.com/8.x/initials/svg?seed=${conversation.contact.name}`}
                alt="Avatar"
            />
            <div className="flex-grow ml-3 overflow-hidden">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-white truncate">{conversation.contact.name}</h3>
                    {conversation.last_message && (
                        <p className="text-xs text-slate-400 flex-shrink-0">
                            {formatTime(conversation.last_message.created_at)}
                        </p>
                    )}
                </div>
                <div className="flex justify-between items-start mt-0.5">
                    <p className="text-sm text-slate-400 truncate pr-2">
                        {conversation.last_message?.type === 'outbound' && 'Você: '}
                        {truncate(conversation.last_message?.content, 30)}
                    </p>
                     {conversation.unread_count > 0 && (
                        <span className="ml-2 flex-shrink-0 bg-sky-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                            {conversation.unread_count}
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
};

const ConversationList: React.FC = () => {
    const { conversations, activeContactId, setActiveContactId, isLoading } = useContext(InboxContext);
    
    return (
        <aside className="w-96 flex-shrink-0 bg-slate-800/50 border-r border-slate-700/50 flex flex-col">
            <div className="p-4 border-b border-slate-700/50">
                <input
                    type="search"
                    placeholder="Pesquisar ou começar nova conversa..."
                    className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-sm text-white placeholder-slate-400"
                />
            </div>
            <ul className="flex-grow overflow-y-auto">
                 {isLoading && conversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Carregando conversas...</div>
                ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Nenhuma conversa encontrada.</div>
                ) : (
                    conversations.map(conv => (
                        <ConversationListItem
                            key={conv.contact.id}
                            conversation={conv}
                            isActive={activeContactId === conv.contact.id}
                            onClick={() => setActiveContactId(conv.contact.id)}
                        />
                    ))
                )}
            </ul>
        </aside>
    );
};

export default ConversationList;
