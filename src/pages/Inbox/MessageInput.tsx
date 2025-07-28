import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SEND_ICON, SPARKLES_ICON } from '../../components/icons';
import Button from '../../components/common/Button';
import { CannedResponse } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { generateReplyWithAI } from '../../services/geminiService';

interface MessageInputProps {
    contactId: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ contactId }) => {
    const [text, setText] = useState('');
    const { sendMessage, isSending, messages, responses, profile } = useAuthStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [showPicker, setShowPicker] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);

    const filteredResponses = useMemo(() => {
        if (!pickerQuery) return [];
        return responses.filter(r =>
            r.shortcut.toLowerCase().startsWith(`/${pickerQuery.toLowerCase()}`)
        );
    }, [responses, pickerQuery]);

    useEffect(() => {
        setActiveIndex(0);
    }, [filteredResponses]);

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
    
    const handleGenerateReply = async () => {
        if (!text.trim() || !profile) return;
        setIsGenerating(true);
        try {
            const companyProfileForAI = {
                name: profile.company_name,
                description: profile.company_description,
                products: profile.company_products,
                audience: profile.company_audience,
                tone: profile.company_tone,
            };
            const conversationHistory = messages
                .slice(-5) // Get last 5 messages for context
                .map(m => ({ type: m.type, content: m.content }));

            const reply = await generateReplyWithAI(text, companyProfileForAI, conversationHistory);
            setText(reply);
        } catch (error: any) {
            alert(`Erro ao gerar resposta com IA: ${error.message}`);
        } finally {
            setIsGenerating(false);
            textareaRef.current?.focus();
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = newText.substring(0, cursorPosition);
        const currentWordMatch = textBeforeCursor.match(/\/\w*$/);

        if (currentWordMatch) {
            setPickerQuery(currentWordMatch[0].substring(1));
            setShowPicker(true);
        } else {
            setShowPicker(false);
        }
    };

    const handleSelectResponse = (response: CannedResponse) => {
        const cursorPosition = textareaRef.current?.selectionStart || text.length;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const textAfterCursor = text.substring(cursorPosition);

        const match = textBeforeCursor.match(/\/\w*$/);
        if (!match) {
            setShowPicker(false);
            return;
        }

        const startIndex = match.index || 0;
        const newText = textBeforeCursor.substring(0, startIndex) + response.content + textAfterCursor;
        
        setText(newText);
        setShowPicker(false);

        // Focus and set cursor position after update
        setTimeout(() => {
            const newCursorPos = startIndex + response.content.length;
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showPicker && filteredResponses.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % filteredResponses.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + filteredResponses.length) % filteredResponses.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleSelectResponse(filteredResponses[activeIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowPicker(false);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    return (
        <form
            onSubmit={handleSend}
            className="flex-shrink-0 p-3 bg-slate-800 flex items-start gap-3"
        >
            <div className="relative flex-1">
                {showPicker && filteredResponses.length > 0 && (
                    <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10 p-2 border border-slate-600">
                        <ul>
                            {filteredResponses.map((res, index) => (
                                <li key={res.id}>
                                    <button
                                        type="button"
                                        className={`w-full text-left p-2 rounded-lg flex justify-between items-center ${activeIndex === index ? 'bg-sky-500/30' : 'hover:bg-slate-600/50'}`}
                                        onMouseDown={(e) => { e.preventDefault(); handleSelectResponse(res); }}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="font-semibold text-sky-300 text-sm">{res.shortcut}</p>
                                            <p className="text-xs text-slate-300 truncate">{res.content}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Escreva uma instrução para a IA ou sua mensagem... Pressione '/' para respostas rápidas"
                    className="flex-1 bg-slate-700 border-slate-600 rounded-xl p-2.5 text-white placeholder-slate-400 resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none w-full"
                    rows={1}
                    style={{ maxHeight: '120px' }}
                />
            </div>

            <Button
                type="button"
                variant="secondary"
                className="w-12 h-12 rounded-full flex-shrink-0"
                onClick={handleGenerateReply}
                isLoading={isGenerating}
                disabled={!text.trim() || isSending}
                title="Gerar resposta com IA"
            >
                {!isGenerating && <SPARKLES_ICON className="w-5 h-5" />}
            </Button>
            
            <Button
                type="submit"
                variant="primary"
                className="w-12 h-12 rounded-full flex-shrink-0"
                isLoading={isSending}
                disabled={!text.trim() || isGenerating}
                title="Enviar Mensagem"
            >
                {!isSending && <SEND_ICON className="w-5 h-5" />}
            </Button>
        </form>
    );
};

export default MessageInput;