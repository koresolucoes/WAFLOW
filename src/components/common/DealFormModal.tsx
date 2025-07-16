
import React, { useState } from 'react';
import { Pipeline, PipelineStage, Deal, DealInsert } from '../../types';
import Button from './Button';
import Modal from './Modal';

interface DealFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (deal: Omit<DealInsert, 'user_id' | 'contact_id' >) => void;
    pipeline: Pipeline;
    stages: PipelineStage[];
    contactName: string;
    deal?: Deal; // Optional for editing
}

const DealFormModal: React.FC<DealFormModalProps> = ({ isOpen, onClose, onSave, pipeline, stages, contactName, deal }) => {
    const [name, setName] = useState(deal?.name || `Negócio - ${contactName}`);
    const [value, setValue] = useState(deal?.value || 0);
    const [stageId, setStageId] = useState(deal?.stage_id || stages.find(s => s.sort_order === 0)?.id || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const dealData: Omit<DealInsert, 'user_id' | 'contact_id' > = {
            name,
            value,
            stage_id: stageId,
            pipeline_id: pipeline.id,
        };

        try {
            await onSave(dealData);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={deal ? 'Editar Negócio' : 'Criar Novo Negócio'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Nome do Negócio</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        className="w-full bg-slate-700 p-2 rounded-md text-white"
                    />
                </div>
                 <div>
                    <label htmlFor="value" className="block text-sm font-medium text-slate-300 mb-1">Valor (R$)</label>
                    <input
                        type="number"
                        id="value"
                        step="0.01"
                        value={value}
                        onChange={e => setValue(parseFloat(e.target.value))}
                        required
                        className="w-full bg-slate-700 p-2 rounded-md text-white"
                    />
                </div>
                 <div>
                    <label htmlFor="stageId" className="block text-sm font-medium text-slate-300 mb-1">Etapa Inicial</label>
                    <select
                        id="stageId"
                        value={stageId}
                        onChange={e => setStageId(e.target.value)}
                        required
                        className="w-full bg-slate-700 p-2 rounded-md text-white"
                    >
                        {stages.sort((a,b) => a.sort_order - b.sort_order).map(stage => (
                            <option key={stage.id} value={stage.id}>{stage.name}</option>
                        ))}
                    </select>
                </div>
                 <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                    <Button type="submit" variant="primary" isLoading={isLoading}>Salvar</Button>
                </div>
            </form>
        </Modal>
    );
};

export default DealFormModal;
