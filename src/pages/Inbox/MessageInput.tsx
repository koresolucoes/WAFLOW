
import React, { useState, useContext } from 'react';
import { InboxContext } from '../../contexts/providers/InboxContext';
import { SEND_ICON } from '../../components/icons';
import Button from '../../components/common/Button';

interface MessageInputProps {
    contactId: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ contactId }) => {
    const [text, setText] = useState('');
    const { sendMessage, isSending } = useContext(InboxContext);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() && !isSending) {
            try {
                await sendMessage(contactId, text.trim());
                setText('');
            } catch (error: any) {
                alert(`Erro ao enviar mensagem: ${error.message}`);
            }
        }
    };

    return (
        <form
            onSubmit={handleSend}
            className="flex-shrink-0 p-3 bg-slate-800 border-t border-slate-700/50 flex items-center gap-3"
        >
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                    }
                }}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-slate-700 border-slate-600 rounded-lg p-2.5 text-white placeholder-slate-400 resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none"
                rows={1}
                style={{ maxHeight: '120px' }}
            />
            <Button
                type="submit"
                variant="primary"
                className="w-12 h-12 rounded-full flex-shrink-0"
                isLoading={isSending}
                disabled={!text.trim()}
            >
                {!isSending && <SEND_ICON className="w-5 h-5" />}
            </Button>
        </form>
    );
};

export default MessageInput;
