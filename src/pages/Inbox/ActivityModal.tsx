import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { ContactActivityInsert } from '../../types';
import { useAuthStore } from '../../stores/authStore';

interface ActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'NOTA' | 'TAREFA';
    contactId: string;
}

const ActivityModal: React.FC<ActivityModalProps> = ({ isOpen, onClose, type, contactId }) => {
    const { addActivity, user } = useAuthStore();
    const [content, setContent] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setContent('');
            setDueDate('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || (type === 'TAREFA' && !dueDate) || !user) return;

        setIsSaving(true);
        const payload: Omit<ContactActivityInsert, 'team_id'> = {
            contact_id: contactId,
            type,
            content: content.trim(),
            due_date: type === 'TAREFA' ? dueDate : null,
            is_completed: false
        };

        try {
            await addActivity(payload);
            onClose();
        } catch (error: any) {
            alert(`Erro ao salvar atividade: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const title = type === 'NOTA' ? 'Adicionar Nova Nota' : 'Adicionar Nova Tarefa';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="activityContent" className="block text-sm font-medium text-slate-300 mb-1">
                        {type === 'NOTA' ? 'Conteúdo da Nota' : 'Descrição da Tarefa'}
                    </label>
                    <textarea
                        id="activityContent"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-700 p-2 rounded-md text-white"
                        required
                    />
                </div>
                {type === 'TAREFA' && (
                     <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-slate-300 mb-1">
                            Data de Vencimento
                        </label>
                        <input
                            type="date"
                            id="dueDate"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="w-full bg-slate-700 p-2 rounded-md text-white"
                            required
                        />
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button type="submit" variant="primary" isLoading={isSaving} disabled={!content.trim() || (type === 'TAREFA' && !dueDate)}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

export default ActivityModal;