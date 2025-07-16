

import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Pipeline, PipelineStage, DealWithContact } from '../../types';
import StageColumn from './StageColumn';
import { FUNNEL_ICON } from '../../components/icons';
import Button from '../../components/common/Button';

const Funnel: React.FC = () => {
    const { pipelines, stages, deals, updateDealStage, createDefaultPipeline } = useContext(AppContext);
    const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // For now, we'll just use the first pipeline. UI for multiple pipelines can be added later.
    const activePipeline = useMemo(() => pipelines[0], [pipelines]);

    const activeStages = useMemo(() => {
        if (!activePipeline) return [];
        return stages
            .filter(s => s.pipeline_id === activePipeline.id)
            .sort((a, b) => a.sort_order - b.sort_order);
    }, [stages, activePipeline]);

    const dealsByStage = useMemo(() => {
        const grouped: { [stageId: string]: DealWithContact[] } = {};
        activeStages.forEach(stage => {
            grouped[stage.id] = [];
        });
        deals.forEach(deal => {
            if (grouped[deal.stage_id]) {
                grouped[deal.stage_id].push(deal);
            }
        });
        return grouped;
    }, [deals, activeStages]);

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

    if (!activePipeline) {
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
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 p-4 border-b border-slate-700/50">
                <h1 className="text-2xl font-bold text-white">{activePipeline.name}</h1>
            </header>
            <main className="flex-grow flex-1 p-4 md:p-6 overflow-x-auto">
                <div className="flex gap-6 h-full">
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
                </div>
            </main>
        </div>
    );
};

export default Funnel;