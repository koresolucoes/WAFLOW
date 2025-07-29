import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { CannedResponse, CannedResponseInsert } from '../../types';
import { PLUS_ICON, TRASH_ICON, BOLT_ICON } from '../../components/icons';
import { TablesUpdate } from '../../types/database.types';
import { useUiStore } from '../../stores/uiStore';

const CannedResponseForm: React.FC<{
    response?: CannedResponse;
    onSave: (data: Omit<CannedResponseInsert, 'user_id' | 'id' | 'created_at'> | TablesUpdate<'canned_responses'>) => Promise<void>;
    onCancel: () => void;
}> = ({ response, onSave, onCancel }) => {
    const [shortcut, setShortcut] = useState(response?.shortcut || '');
    const [content, setContent] = useState(response?.content || '');
    const [isLoading, setIsLoading] = useState(false);
    
    const baseInputClass = "w-full bg-gray-50 dark:bg-slate-700 p-2 rounded-md text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600";
    const baseLabelClass = "block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shortcut.trim() || !content.trim()) return;
        setIsLoading(true);
        try {
            await onSave({ shortcut: shortcut.trim(), content: content.trim() });
            onCancel();
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className={baseLabelClass}>Atalho</label>
                <input
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="/agradecimento"
                    className={baseInputClass}
                    required
                />
            </div>
            <div>
                <label className={baseLabelClass}>Conteúdo da Mensagem</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder="Obrigado pelo seu contato!"
                    className={baseInputClass}
                    required
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" variant="primary" isLoading={isLoading}>Salvar</Button>
            </div>
        </form>
    );
};

const CannedResponsesSettings: React.FC = () => {
    const { responses, addResponse, updateResponse, deleteResponse } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);

    const handleOpenModal = (response?: CannedResponse) => {
        setEditingResponse(response || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingResponse(null);
    };

    const handleSave = async (data: Omit<CannedResponseInsert, 'user_id' | 'id' | 'created_at'> | TablesUpdate<'canned_responses'>) => {
        if (editingResponse) {
            await updateResponse(editingResponse.id, data);
        } else {
            await addResponse(data as Omit<CannedResponseInsert, 'user_id' | 'id' | 'created_at'>);
        }
    };

    const handleDelete = async (id: string) => {
        showConfirmation(
            'Excluir Resposta Rápida',
            "Tem certeza que deseja excluir esta resposta?",
            async () => {
                try {
                    await deleteResponse(id);
                    addToast('Resposta excluída.', 'success');
                } catch(err: any) {
                    addToast(`Erro ao excluir: ${err.message}`, 'error');
                }
            }
        );
    };

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gerenciar Respostas Rápidas</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400">Crie atalhos para mensagens usadas com frequência na Caixa de Entrada.</p>
                    </div>
                    <Button variant="primary" onClick={() => handleOpenModal()}>
                        <PLUS_ICON className="w-5 h-5 mr-2" />
                        Nova Resposta
                    </Button>
                </div>

                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                    {responses.length > 0 ? (
                        <ul className="divide-y divide-gray-200 dark:divide-slate-700/50">
                            {responses.map(res => (
                                <li key={res.id} className="p-3 flex justify-between items-start group">
                                    <div className="flex-grow cursor-pointer" onClick={() => handleOpenModal(res)}>
                                        <p className="font-semibold text-blue-600 dark:text-sky-400 font-mono">{res.shortcut}</p>
                                        <p className="text-sm text-gray-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{res.content}</p>
                                    </div>
                                    <div className="flex-shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(res.id); }} className="text-red-500 hover:bg-red-100/50 dark:text-red-400 dark:hover:bg-red-500/10">
                                            <TRASH_ICON className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center text-gray-500 dark:text-slate-400 p-6 flex flex-col items-center">
                            <BOLT_ICON className="w-10 h-10 text-gray-400 dark:text-slate-500 mb-2"/>
                            <span>Nenhuma resposta rápida criada ainda.</span>
                        </div>
                    )}
                </div>
            </Card>
            
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingResponse ? "Editar Resposta Rápida" : "Criar Resposta Rápida"}
            >
                <CannedResponseForm
                    response={editingResponse || undefined}
                    onSave={handleSave}
                    onCancel={handleCloseModal}
                />
            </Modal>
        </>
    );
};

export default CannedResponsesSettings;