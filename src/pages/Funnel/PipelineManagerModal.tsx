import React, { useContext, useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { TRASH_ICON } from '../../components/icons';
import { Pipeline } from '../../types';
import { FunnelContext } from '../../contexts/providers/FunnelContext';

const PipelineManagerModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { pipelines, addPipeline, updatePipeline, deletePipeline } = useContext(FunnelContext);
    const [newPipelineName, setNewPipelineName] = useState('');
    const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAddPipeline = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPipelineName.trim()) {
            await addPipeline(newPipelineName.trim());
            setNewPipelineName('');
        }
    };

    const handleUpdateName = async (pipeline: Pipeline) => {
        if (editingName.trim() && editingName !== pipeline.name) {
            await updatePipeline(pipeline.id, editingName.trim());
        }
        setEditingPipelineId(null);
        setEditingName('');
    };

    const handleDelete = (pipelineId: string) => {
        if (window.confirm("Tem certeza que deseja excluir este funil? Todos os negócios e etapas associados serão perdidos permanentemente.")) {
            deletePipeline(pipelineId);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Funis de Vendas">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Funis Atuais</h3>
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                        {pipelines.map(p => (
                            <li key={p.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-md">
                                {editingPipelineId === p.id ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => handleUpdateName(p)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateName(p)}
                                        autoFocus
                                        className="bg-slate-800 text-white p-1 rounded-md w-full"
                                    />
                                ) : (
                                    <span onClick={() => { setEditingPipelineId(p.id); setEditingName(p.name); }} className="cursor-pointer text-white">
                                        {p.name}
                                    </span>
                                )}
                                <div className="flex items-center">
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-400 hover:bg-red-500/10">
                                        <TRASH_ICON className="w-4 h-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <form onSubmit={handleAddPipeline} className="border-t border-slate-700 pt-4">
                    <h3 className="text-lg font-semibold text-white mb-2">Criar Novo Funil</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newPipelineName}
                            onChange={(e) => setNewPipelineName(e.target.value)}
                            placeholder="Nome do novo funil"
                            className="w-full bg-slate-700 p-2 rounded-md text-white"
                        />
                        <Button type="submit" variant="primary">Criar</Button>
                    </div>
                </form>
            </div>
            <div className="mt-6 flex justify-end">
                <Button variant="secondary" onClick={onClose}>Fechar</Button>
            </div>
        </Modal>
    );
};

export default PipelineManagerModal;
