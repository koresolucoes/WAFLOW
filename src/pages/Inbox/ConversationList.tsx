import React, { useContext, useState, useMemo } from 'react';
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
            className={`flex items-center p-3 cursor-pointer transition-colors duration-150 rounded-lg ${isActive ? 'bg-slate-700/80' : 'hover:bg-slate-800/50'}`}
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

const FilterButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${isActive ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
    >
        {label}
    </button>
);

const ConversationList: React.FC = () => {
    const { conversations, activeContactId, setActiveContactId, isLoading } = useContext(InboxContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const filteredConversations = useMemo(() => {
        return conversations
            .filter(conv => {
                if (filter === 'unread') {
                    return conv.unread_count > 0;
                }
                return true;
            })
            .filter(conv => {
                if (searchTerm.trim() === '') return true;
                return conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase());
            });
    }, [conversations, searchTerm, filter]);
    
    return (
        <aside className="w-96 flex-shrink-0 bg-slate-800/10 border-r border-slate-700/50 flex flex-col">
            <div className="p-4 space-y-3">
                <input
                    type="search"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border-slate-600 rounded-lg p-2 text-sm text-white placeholder-slate-400"
                />
                <div className="flex items-center gap-2">
                    <FilterButton label="Todas" isActive={filter === 'all'} onClick={() => setFilter('all')} />
                    <FilterButton label="Não Lidas" isActive={filter === 'unread'} onClick={() => setFilter('unread')} />
                </div>
            </div>
            <ul className="flex-grow overflow-y-auto px-2">
                 {isLoading && conversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Carregando conversas...</div>
                ) : filteredConversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Nenhuma conversa encontrada.</div>
                ) : (
                    filteredConversations.map(conv => (
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