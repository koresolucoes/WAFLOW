import React, { useContext, useMemo, useState } from 'react';
import StageColumn from './StageColumn';
import { FUNNEL_ICON, PLUS_ICON } from '../../components/icons';
import Button from '../../components/common/Button';
import PipelineManagerModal from './PipelineManagerModal';
import { FunnelContext } from '../../contexts/providers/FunnelContext';

const Funnel: React.FC = () => {
    const { 
        pipelines, stages, deals, updateDealStage, createDefaultPipeline, 
        activePipelineId, setActivePipelineId, addStage,
    } = useContext(FunnelContext);

    const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const activePipeline = useMemo(() => {
        return pipelines.find(p => p.id === activePipelineId);
    }, [pipelines, activePipelineId]);

    const activeStages = useMemo(() => {
        if (!activePipeline) return [];
        return stages
            .filter(s => s.pipeline_id === activePipeline.id)
            .sort((a, b) => a.sort_order - b.sort_order);
    }, [stages, activePipeline]);

    const dealsByStage = useMemo(() => {
        const grouped: { [stageId: string]: any[] } = {};
        activeStages.forEach(stage => {
            grouped[stage.id] = [];
        });
        deals.forEach(deal => {
            if (deal.pipeline_id === activePipelineId && grouped[deal.stage_id]) {
                grouped[deal.stage_id].push(deal);
            }
        });
        return grouped;
    }, [deals, activeStages, activePipelineId]);

    const handleDragStart = (dealId: string) => {
        setDraggedDealId(dealId);
    };

    const handleDrop = (stageId: string) => {
        if (draggedDealId) {
            const deal = deals.find(d => d.id === draggedDealId);
            if (deal && deal.stage_id !== stageId) {
                updateDealStage(draggedDealId, stageId);
            }
        }
        setDraggedDealId(null);
    };

    const handleCreatePipeline = async () => {
        setIsCreating(true);
        try {
            await createDefaultPipeline();
        } catch (error: any) {
            alert(`Falha ao criar funil: ${error.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddStage = () => {
        if(activePipeline) {
            addStage(activePipeline.id);
        }
    };

    if (pipelines.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <FUNNEL_ICON className="w-16 h-16 mb-4 text-slate-500" />
                <h2 className="text-2xl text-white font-bold">Nenhum funil de vendas encontrado.</h2>
                <p className="mt-2 mb-6">Parece que um funil padrão não foi criado para sua conta.</p>
                <Button onClick={handleCreatePipeline} isLoading={isCreating}>
                    Criar Funil Padrão
                </Button>
            </div>
        )
    }

    return (
        <>
            <div className="h-full flex flex-col">
                <header className="flex-shrink-0 p-4 border-b border-slate-700/50 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-white">Funil</h1>
                        <select
                            value={activePipelineId || ''}
                            onChange={(e) => setActivePipelineId(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm"
                        >
                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <Button variant="secondary" onClick={() => setIsManagerOpen(true)}>Gerenciar Funis</Button>
                </header>
                <main className="flex-grow flex-1 p-4 md:p-6 overflow-x-auto">
                    <div className="flex gap-6 h-full min-w-max">
                        {activeStages.map(stage => (
                            <StageColumn
                                key={stage.id}
                                stage={stage}
                                deals={dealsByStage[stage.id] || []}
                                onDragStart={handleDragStart}
                                onDrop={handleDrop}
                                draggedDealId={draggedDealId}
                            />
                        ))}
                        <div className="w-80 flex-shrink-0 h-full flex items-center justify-center">
                            <Button variant="ghost" className="w-full h-full border-2 border-dashed border-slate-700 hover:bg-slate-800 hover:border-sky-500" onClick={handleAddStage}>
                                <PLUS_ICON className="w-5 h-5 mr-2" />
                                Adicionar Etapa
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
            <PipelineManagerModal isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
        </>
    );
};

export default Funnel;
