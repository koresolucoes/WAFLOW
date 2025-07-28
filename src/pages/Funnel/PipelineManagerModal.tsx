import React, { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { TRASH_ICON, PLUS_ICON } from '../../components/icons';
import { Pipeline, PipelineStage, StageType } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

const StageRow: React.FC<{ stage: PipelineStage }> = ({ stage }) => {
    const { updateStage, deleteStage } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();
    const [name, setName] = useState(stage.name);

    const handleNameBlur = () => {
        if (name.trim() && name !== stage.name) {
            updateStage(stage.id, { name: name.trim() });
        } else {
            setName(stage.name);
        }
    };
    
    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateStage(stage.id, { type: e.target.value as StageType });
    };

    const handleDelete = () => {
        showConfirmation(
            'Excluir Etapa',
            "A exclusão de uma etapa é permanente. Todos os negócios nesta etapa precisarão ser movidos. Deseja continuar?",
            async () => {
                try {
                    await deleteStage(stage.id);
                    addToast('Etapa excluída.', 'success');
                } catch(err: any) {
                    addToast(`Erro ao excluir: ${err.message}`, 'error');
                }
            }
        );
    };

    return (
        <div className="flex items-center gap-2 p-1.5 bg-slate-800 rounded">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="bg-transparent text-white text-sm p-1 rounded-md w-full focus:bg-slate-900 focus:outline-none"
            />
            <select
                value={stage.type}
                onChange={handleTypeChange}
                className="bg-slate-700 text-white text-xs p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
                <option value="Intermediária">Intermediária</option>
                <option value="Ganho">Ganho</option>
                <option value="Perdido">Perdido</option>
            </select>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 hover:bg-red-500/10">
                <TRASH_ICON className="w-4 h-4" />
            </Button>
        </div>
    );
};


const PipelineManagerModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { pipelines, stages, addPipeline, updatePipeline, deletePipeline, addStage } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();
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
        showConfirmation(
            'Excluir Funil',
            "Tem certeza que deseja excluir este funil? Todos os negócios e etapas associados serão perdidos permanentemente.",
            async () => {
                try {
                    await deletePipeline(pipelineId);
                    addToast('Funil excluído.', 'success');
                } catch (err: any) {
                    addToast(`Erro ao excluir funil: ${err.message}`, 'error');
                }
            }
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Funis & Etapas">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Funis Atuais</h3>
                    <div className="space-y-4 max-h-80 overflow-y-auto p-1">
                        {pipelines.map(p => (
                            <div key={p.id} className="p-3 bg-slate-700/50 rounded-md">
                                <div className="flex items-center justify-between mb-2">
                                    {editingPipelineId === p.id ? (
                                        <input
                                            type="text" value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onBlur={() => handleUpdateName(p)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateName(p)}
                                            autoFocus
                                            className="bg-slate-800 text-white p-1 rounded-md w-full font-semibold"
                                        />
                                    ) : (
                                        <h4 onClick={() => { setEditingPipelineId(p.id); setEditingName(p.name); }} className="cursor-pointer text-white font-semibold">
                                            {p.name}
                                        </h4>
                                    )}
                                    <div className="flex items-center">
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-400 hover:bg-red-500/10">
                                            <TRASH_ICON className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {stages.filter(s => s.pipeline_id === p.id).sort((a, b) => a.sort_order - b.sort_order).map(s => (
                                        <StageRow key={s.id} stage={s} />
                                    ))}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => addStage(p.id)} className="mt-2 w-full text-slate-300">
                                    <PLUS_ICON className="w-4 h-4 mr-2" /> Adicionar Etapa
                                </Button>
                            </div>
                        ))}
                    </div>
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