
import React, { useState, useContext } from 'react';
import { CustomFieldsContext } from '../../contexts/providers/CustomFieldsContext';
import { CustomFieldDefinitionInsert, CustomFieldType } from '../../types';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { PLUS_ICON, TRASH_ICON } from '../../components/icons';

type EditableDefinition = Omit<CustomFieldDefinitionInsert, 'id' | 'user_id' | 'created_at'>;

const CustomFieldsSettings: React.FC = () => {
    const { definitions, addDefinition, deleteDefinition } = useContext(CustomFieldsContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
            .replace(/\s+/g, '_') //-
            .replace(/[^\w-]+/g, '')
            .replace(/__+/g, '_')
            .replace(/^-+/, '')
            .replace(/-+$/, '');

    const handleOpenModal = () => {
        setError(null);
        setFormData({ name: '', key: '', type: 'TEXTO', options: null });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'name') {
            setFormData(prev => ({ ...prev, name: value, key: slugify(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
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
            setIsModalOpen(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este campo? Esta ação não pode ser desfeita.")) {
            try {
                await deleteDefinition(id);
            } catch (err: any) {
                alert(`Erro ao excluir: ${err.message}`);
            }
        }
    };

    return (
        <>
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Gerenciar Campos Personalizados</h2>
                        <p className="text-sm text-slate-400">Crie e gerencie campos de dados para seus contatos.</p>
                    </div>
                    <Button variant="primary" onClick={handleOpenModal}>
                        <PLUS_ICON className="w-5 h-5 mr-2" />
                        Adicionar Campo
                    </Button>
                </div>
                
                <div className="bg-slate-900/50 rounded-lg">
                    {definitions.length > 0 ? (
                        <ul className="divide-y divide-slate-700/50">
                            {definitions.map(def => (
                                <li key={def.id} className="p-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-white">{def.name}</p>
                                        <p className="text-xs text-slate-400 font-mono">{def.key} - <span className="uppercase">{def.type}</span></p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(def.id)} className="text-red-400 hover:bg-red-500/10">
                                        <TRASH_ICON className="w-4 h-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-slate-400 p-6">Nenhum campo personalizado foi criado ainda.</p>
                    )}
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Campo Personalizado">
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
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="primary" isLoading={isLoading}>Salvar</Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default CustomFieldsSettings;
