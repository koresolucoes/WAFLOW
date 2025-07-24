


import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { Pipeline, PipelineStage, DealInsert, DealWithContact } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import * as funnelService from '../../services/funnelService';

interface FunnelContextType {
    pipelines: Pipeline[];
    stages: PipelineStage[];
    deals: DealWithContact[];
    activePipelineId: string | null;
    setPipelines: React.Dispatch<React.SetStateAction<Pipeline[]>>;
    setStages: React.Dispatch<React.SetStateAction<PipelineStage[]>>;
    setDeals: React.Dispatch<React.SetStateAction<DealWithContact[]>>;
    setActivePipelineId: (id: string | null) => void;
    addDeal: (dealData: DealInsert) => Promise<void>;
    updateDealStage: (dealId: string, newStageId: string) => Promise<void>;
    createDefaultPipeline: () => Promise<void>;
    addPipeline: (name: string) => Promise<void>;
    updatePipeline: (id: string, name: string) => Promise<void>;
    deletePipeline: (id: string) => Promise<void>;
    addStage: (pipelineId: string) => Promise<void>;
    updateStage: (id: string, name: string) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;
}

export const FunnelContext = createContext<FunnelContextType>(null!);

export const FunnelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const user = useAuthStore(state => state.user);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [deals, setDeals] = useState<DealWithContact[]>([]);
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    
    const addDeal = useCallback(async (dealData: DealInsert) => {
        if (!user) throw new Error("User not authenticated.");
        const newDeal = await funnelService.addDealToDb(dealData);
        setDeals(prev => [newDeal, ...prev]);
    }, [user]);

    const updateDealStage = useCallback(async (dealId: string, newStageId: string) => {
        if (!user) throw new Error("User not authenticated.");
        const updatedDeal = await funnelService.updateDealStageInDb(dealId, newStageId);
        setDeals(prev => prev.map(d => d.id === dealId ? updatedDeal : d));
    }, [user]);

    const createDefaultPipeline = useCallback(async () => {
        if (!user) throw new Error("User not authenticated.");
        const { pipeline, stages: newStages } = await funnelService.createDefaultPipelineInDb(user.id);
        setPipelines(prev => [...prev, pipeline]);
        setStages(prev => [...prev, ...newStages]);
        setActivePipelineId(pipeline.id);
    }, [user]);

    const addPipeline = useCallback(async (name: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { pipeline, stage } = await funnelService.addPipelineToDb(user.id, name);
        setPipelines(p => [...p, pipeline]);
        setStages(s => [...s, stage]);
        setActivePipelineId(pipeline.id);
    }, [user]);

    const updatePipeline = useCallback(async (id: string, name: string) => {
        if (!user) throw new Error("User not authenticated.");
        const updatedPipeline = await funnelService.updatePipelineInDb(id, name);
        setPipelines(p => p.map(pl => pl.id === id ? updatedPipeline : pl));
    }, [user]);

    const deletePipeline = useCallback(async (id: string) => {
        if (!user) throw new Error("User not authenticated.");
        await funnelService.deletePipelineFromDb(id);
        setStages(s => s.filter(stage => stage.pipeline_id !== id));
        setDeals(d => d.filter(deal => deal.pipeline_id !== id));
        const remainingPipelines = pipelines.filter(p => p.id !== id);
        setPipelines(remainingPipelines);
        if (activePipelineId === id) {
            setActivePipelineId(remainingPipelines.length > 0 ? remainingPipelines[0].id : null);
        }
    }, [user, pipelines, activePipelineId]);

    const addStage = useCallback(async (pipelineId: string) => {
        if (!user) throw new Error("User not authenticated.");
        const maxSortOrder = stages.filter(s => s.pipeline_id === pipelineId).reduce((max, s) => Math.max(max, s.sort_order), -1);
        const newStage = await funnelService.addStageToDb(pipelineId, maxSortOrder + 1);
        setStages(prev => [...prev, newStage]);
    }, [user, stages]);

    const updateStage = useCallback(async (id: string, name: string) => {
        if (!user) throw new Error("User not authenticated.");
        const updatedStage = await funnelService.updateStageInDb(id, name);
        setStages(s => s.map(stage => stage.id === id ? updatedStage : stage));
    }, [user]);

    const deleteStage = useCallback(async (id: string) => {
        if (!user) throw new Error("User not authenticated.");
        await funnelService.deleteStageFromDb(id);
        setStages(s => s.filter(stage => stage.id !== id));
    }, [user]);

    const value = {
        pipelines, setPipelines,
        stages, setStages,
        deals, setDeals,
        activePipelineId, setActivePipelineId,
        addDeal, updateDealStage, createDefaultPipeline,
        addPipeline, updatePipeline, deletePipeline,
        addStage, updateStage, deleteStage
    };

    return (
        <FunnelContext.Provider value={value}>
            {children}
        </FunnelContext.Provider>
    );
};