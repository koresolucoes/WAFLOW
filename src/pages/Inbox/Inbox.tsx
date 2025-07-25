import React, { useContext, useState } from 'react';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import ContactPanel from './ContactPanel';
import { InboxContext } from '../../contexts/providers/InboxContext';
import { INBOX_ICON } from '../../components/icons';

const Inbox: React.FC = () => {
    const { activeContactId } = useContext(InboxContext);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    return (
        <div className="h-full flex flex-col bg-slate-900">
            <header className="flex-shrink-0 p-4 border-b border-slate-700/50">
                <h1 className="text-2xl font-bold text-white">Caixa de Entrada</h1>
            </header>
            <main className="flex-grow flex-1 flex overflow-hidden">
                <ConversationList />
                <div className="flex-1 flex overflow-hidden">
                    {activeContactId ? (
                        <>
                            <ChatWindow 
                                isPanelOpen={isPanelOpen} 
                                setIsPanelOpen={setIsPanelOpen} 
                            />
                            {isPanelOpen && <ContactPanel contactId={activeContactId} />}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-900 p-8">
                            <INBOX_ICON className="w-20 h-20 text-slate-600 mb-4" />
                            <h2 className="text-xl font-semibold text-white">Selecione uma conversa</h2>
                            <p className="text-slate-400 mt-1">Escolha uma conversa da lista à esquerda para ver as mensagens.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Inbox;
