import React, { useState, useMemo } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import InfoCard from '../../components/common/InfoCard';
import { Contact } from '../../types';
import { useAuthStore } from '../../stores/authStore';

interface DirectMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (message: string, recipients: Contact[]) => Promise<void>;
    contacts: Contact[];
    isSending: boolean;
}

const DirectMessageModal: React.FC<DirectMessageModalProps> = ({ isOpen, onClose, onSend, contacts, isSending }) => {
    const { allTags } = useAuthStore();
    const [message, setMessage] = useState('');
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    
    const recipients = useMemo(() => {
        if (sendToAll) return contacts;
        if (selectedTags.length === 0) return [];
        return contacts.filter(contact =>
            contact.tags && selectedTags.every(tag => contact.tags!.includes(tag))
        );
    }, [contacts, selectedTags, sendToAll]);
    
    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };
    
    const handleSendClick = () => {
        if (message.trim() && recipients.length > 0) {
            onSend(message.trim(), recipients);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enviar Mensagem Direta">
            <div className="space-y-4">
                <InfoCard variant="warning">
                    <h3 className="font-semibold text-amber-200">Atenção: Use com Cuidado</h3>
                    <p className="text-sm">O envio de mensagens diretas só é permitido para contatos que interagiram com você nas <strong>últimas 24 horas</strong>. O envio em massa fora desta janela pode violar as políticas do WhatsApp e resultar no bloqueio da sua conta.</p>
                </InfoCard>

                <div>
                    <label htmlFor="directMessage" className="block text-sm font-medium text-slate-300 mb-1">
                        Mensagem
                    </label>
                    <textarea
                        id="directMessage"
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-500"
                        placeholder="Digite sua mensagem aqui..."
                    />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Selecionar Destinatários
                  </label>
                  <div className="space-y-3 p-4 bg-slate-700/50 rounded-md">
                      <div className="flex items-center">
                          <input type="radio" id="dmSendToAll" name="dmRecipientType" checked={sendToAll} onChange={() => setSendToAll(true)} className="h-4 w-4 text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"/>
                          <label htmlFor="dmSendToAll" className="ml-3 block text-sm font-medium text-white">
                              Todos os Contatos ({contacts.length})
                          </label>
                      </div>
                      <div className="flex items-center">
                          <input type="radio" id="dmSendToSegment" name="dmRecipientType" checked={!sendToAll} onChange={() => setSendToAll(false)} className="h-4 w-4 text-sky-600 bg-slate-800 border-slate-600 focus:ring-sky-500"/>
                          <label htmlFor="dmSendToSegment" className="ml-3 block text-sm font-medium text-white">
                              Segmentar por Tags
                          </label>
                      </div>
                      {!sendToAll && (
                          <div className="pl-7 pt-2 space-y-2 max-h-48 overflow-y-auto">
                               {allTags.length > 0 ? (
                                    allTags.map(tag => (
                                        <div key={tag} className="flex items-center">
                                            <input
                                                id={`dm-tag-${tag}`}
                                                type="checkbox"
                                                checked={selectedTags.includes(tag)}
                                                onChange={() => handleTagToggle(tag)}
                                                className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-sky-600 focus:ring-sky-500"
                                            />
                                            <label htmlFor={`dm-tag-${tag}`} className="ml-3 text-sm text-slate-300">
                                                {tag}
                                            </label>
                                        </div>
                                    ))
                               ) : (
                                   <p className="text-sm text-slate-400">Nenhuma tag encontrada para segmentar.</p>
                               )}
                          </div>
                      )}
                      <div className="pt-2 text-center text-sm font-semibold text-sky-300">
                          <p>Total de destinatários: {recipients.length}</p>
                      </div>
                  </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose} disabled={isSending}>Cancelar</Button>
                <Button variant="primary" onClick={handleSendClick} isLoading={isSending} disabled={!message.trim() || recipients.length === 0}>
                    Enviar para {recipients.length} Contato(s)
                </Button>
            </div>
        </Modal>
    );
};

export default DirectMessageModal;