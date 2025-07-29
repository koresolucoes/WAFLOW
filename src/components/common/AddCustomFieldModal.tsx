import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { CustomFieldDefinitionInsert } from '../../types';
import Modal from './Modal';
import Button from './Button';

interface AddCustomFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type EditableDefinition = Omit<CustomFieldDefinitionInsert, 'id' | 'team_id' | 'created_at'>;

const AddCustomFieldModal: React.FC<AddCustomFieldModalProps> = ({ isOpen, onClose }) => {
    const { addDefinition } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<EditableDefinition>({
        name: '',
        key: '',
        type: 'TEXTO',
        options: null,
    });

    const slugify = (text: string) =>
        text.toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^\w-]+/g, '')
            .replace(/__+/g, '_')
            .replace(/^-+/, '')
            .replace(/-+$/, '');

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'name') {
            setFormData(prev => ({ ...prev, name: value, key: slugify(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleOpen = () => {
        setError(null);
        setFormData({ name: '', key: '', type: 'TEXTO', options: null });
    };

    // Effect to reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            handleOpen();
        }
    }, [isOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.key) {
            setError("Nome e Chave do campo são obrigatórios.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            const definitionToSave: Omit<CustomFieldDefinitionInsert, 'team_id' | 'id' | 'created_at'> = {
                name: formData.name,
                key: formData.key,
                type: formData.type,
                options: formData.type === 'LISTA' ? formData.options?.toString().split(',').map(o => o.trim()).filter(Boolean) || [] : null
            };
            await addDefinition(definitionToSave);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const baseInputClass = "w-full bg-gray-50 dark:bg-slate-700 p-2 rounded-md text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600";
    const baseLabelClass = "block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Campo Personalizado">
            <form onSubmit={handleSave} className="space-y-4">
                {error && <p className="text-red-500 dark:text-red-400 text-sm p-2 bg-red-100/50 dark:bg-red-500/10 rounded-md">{error}</p>}
                <div>
                    <label className={baseLabelClass}>Nome do Campo</label>
                    <input name="name" value={formData.name} onChange={handleFormChange} placeholder="Ex: Data de Nascimento" className={baseInputClass} required />
                </div>
                <div>
                    <label className={baseLabelClass}>Chave do Campo</label>
                    <input name="key" value={formData.key} onChange={handleFormChange} placeholder="Ex: data_nascimento" className={`${baseInputClass} font-mono`} required />
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Identificador único para o campo (sem espaços ou caracteres especiais).</p>
                </div>
                    <div>
                    <label className={baseLabelClass}>Tipo de Campo</label>
                    <select name="type" value={formData.type} onChange={handleFormChange} className={baseInputClass}>
                        <option value="TEXTO">Texto</option>
                        <option value="NUMERO">Número</option>
                        <option value="DATA">Data</option>
                        <option value="LISTA">Lista de Opções</option>
                    </select>
                </div>
                {formData.type === 'LISTA' && (
                        <div>
                        <label className={baseLabelClass}>Opções da Lista</label>
                        <textarea name="options" value={Array.isArray(formData.options) ? formData.options.join(', ') : formData.options || ''} onChange={handleFormChange} rows={3} placeholder="Opção 1, Opção 2, Opção 3" className={baseInputClass} />
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Separe as opções por vírgula.</p>
                    </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" variant="primary" isLoading={isLoading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

export default AddCustomFieldModal;