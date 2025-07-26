import React, { useState, useContext } from 'react';
import { CustomFieldsContext } from '../../contexts/providers/CustomFieldsContext';
import { CustomFieldDefinitionInsert } from '../../types';
import Modal from './Modal';
import Button from './Button';

interface AddCustomFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type EditableDefinition = Omit<CustomFieldDefinitionInsert, 'id' | 'user_id' | 'created_at'>;

const AddCustomFieldModal: React.FC<AddCustomFieldModalProps> = ({ isOpen, onClose }) => {
    const { addDefinition } = useContext(CustomFieldsContext);
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
            const definitionToSave: Omit<CustomFieldDefinitionInsert, 'user_id'> = {
                name: formData.name,
                key: formData.key,
                type: formData.type,
                options: formData.type === 'LISTA' ? formData.options?.toString().split(',').map(o => o.trim()).filter(Boolean) || [] : null
            };
            await addDefinition(definitionToSave as any);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Campo Personalizado">
            <form onSubmit={handleSave} className="space-y-4">
                {error && <p className="text-red-400 text-sm p-2 bg-red-500/10 rounded-md">{error}</p>}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nome do Campo</label>
                    <input name="name" value={formData.name} onChange={handleFormChange} placeholder="Ex: Data de Nascimento" className="w-full bg-slate-700 p-2 rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Chave do Campo</label>
                    <input name="key" value={formData.key} onChange={handleFormChange} placeholder="Ex: data_nascimento" className="w-full bg-slate-700 p-2 rounded-md font-mono" required />
                        <p className="text-xs text-slate-400 mt-1">Identificador único para o campo (sem espaços ou caracteres especiais).</p>
                </div>
                    <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Campo</label>
                    <select name="type" value={formData.type} onChange={handleFormChange} className="w-full bg-slate-700 p-2 rounded-md">
                        <option value="TEXTO">Texto</option>
                        <option value="NUMERO">Número</option>
                        <option value="DATA">Data</option>
                        <option value="LISTA">Lista de Opções</option>
                    </select>
                </div>
                {formData.type === 'LISTA' && (
                        <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Opções da Lista</label>
                        <textarea name="options" value={Array.isArray(formData.options) ? formData.options.join(', ') : formData.options || ''} onChange={handleFormChange} rows={3} placeholder="Opção 1, Opção 2, Opção 3" className="w-full bg-slate-700 p-2 rounded-md" />
                        <p className="text-xs text-slate-400 mt-1">Separe as opções por vírgula.</p>
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
