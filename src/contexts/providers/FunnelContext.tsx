

import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Pipeline, PipelineStage, Deal, DealInsert, DealWithContact } from '../../types';
import { TablesInsert } from '../../types/database.types';
import { AuthContext } from './AuthContext';

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
    const { user } = useContext(AuthContext);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [deals, setDeals] = useState<DealWithContact[]>([]);
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    
    const addDeal = useCallback(async (dealData: DealInsert) => {
        if (!user) throw new Error("User not authenticated.");
        const { data, error } = await supabase.from('deals').insert(dealData as any).select('*, contacts(id, name)').single();
        if(error) throw error;
        if (data) {
            setDeals(prev => [data as unknown as DealWithContact, ...prev]);
        }
    }, [user]);

    const updateDealStage = useCallback(async (dealId: string, newStageId: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { data, error } = await supabase.from('deals').update({ stage_id: newStageId } as any).eq('id', dealId).select('*, contacts(id, name)').single();
        if(error) throw error;
        if (data) {
            setDeals(prev => prev.map(d => d.id === dealId ? (data as unknown as DealWithContact) : d));
        }
    }, [user]);

    const createDefaultPipeline = useCallback(async () => {
        if (!user) throw new Error("User not authenticated.");

        const { data: pipelineData, error: pipelineError } = await supabase.from('pipelines').insert({ user_id: user.id, name: 'Funil de Vendas Padrão' } as any).select('*').single();
        if (pipelineError || !pipelineData) throw pipelineError || new Error("Falha ao criar funil.");
        
        const pipelineDataTyped = pipelineData as unknown as Pipeline;
        const defaultStages = [ { name: 'Novo Lead', sort_order: 0 }, { name: 'Contato Feito', sort_order: 1 }, { name: 'Proposta Enviada', sort_order: 2 }, { name: 'Negociação', sort_order: 3 }, { name: 'Ganhos', sort_order: 4 }, { name: 'Perdidos', sort_order: 5 } ];
        const stagesToInsert: TablesInsert<'pipeline_stages'>[] = defaultStages.map(stage => ({ ...stage, pipeline_id: pipelineDataTyped.id }));
        const { data: stagesData, error: stagesError } = await supabase.from('pipeline_stages').insert(stagesToInsert as any).select();

        if (stagesError || !stagesData) {
            await supabase.from('pipelines').delete().eq('id', pipelineDataTyped.id);
            throw stagesError || new Error("Falha ao criar etapas.");
        }
        
        setPipelines(prev => [...prev, pipelineDataTyped as Pipeline]);
        setStages(prev => [...prev, ...(stagesData as unknown as PipelineStage[])]);
        setActivePipelineId(pipelineDataTyped.id);
    }, [user]);

    const addPipeline = useCallback(async (name: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { data: pipelineData, error } = await supabase.from('pipelines').insert({ user_id: user.id, name } as any).select('*').single();
        if (error || !pipelineData) throw error || new Error("Falha ao criar funil.");

        const pipelineDataTyped = pipelineData as unknown as Pipeline;
        const defaultStages = [ { name: 'Nova Etapa', sort_order: 0 } ];
        const stagesToInsert : TablesInsert<'pipeline_stages'>[] = defaultStages.map(s => ({ ...s, pipeline_id: pipelineDataTyped.id }));
        const { data: stagesData, error: stagesError } = await supabase.from('pipeline_stages').insert(stagesToInsert as any).select();

        if (stagesError || !stagesData) throw stagesError || new Error("Falha ao criar etapa inicial.");

        setPipelines(p => [...p, pipelineDataTyped as Pipeline]);
        setStages(s => [...s, ...(stagesData as unknown as PipelineStage[])]);
        setActivePipelineId(pipelineDataTyped.id);
    }, [user]);

    const updatePipeline = useCallback(async (id: string, name: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { data, error } = await supabase.from('pipelines').update({ name } as any).eq('id', id).select('*').single();
        if (error || !data) throw error || new Error("Falha ao renomear funil.");
        setPipelines(p => p.map(pl => pl.id === id ? (data as unknown as Pipeline) : pl));
    }, [user]);

    const deletePipeline = useCallback(async (id: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { error } = await supabase.from('pipelines').delete().eq('id', id);
        if (error) throw error;

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
        const newStagePayload: TablesInsert<'pipeline_stages'> = {
            pipeline_id: pipelineId,
            name: 'Nova Etapa',
            sort_order: maxSortOrder + 1,
        };
        const { data, error } = await supabase.from('pipeline_stages').insert(newStagePayload as any).select('*').single();
        
        if (error) throw error;
        if (data) setStages(prev => [...prev, data as unknown as PipelineStage]);
    }, [user, stages]);

    const updateStage = useCallback(async (id: string, name: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { data, error } = await supabase.from('pipeline_stages').update({ name } as any).eq('id', id).select('*').single();
        if (error || !data) throw error || new Error("Falha ao renomear etapa.");
        setStages(s => s.map(stage => stage.id === id ? (data as unknown as PipelineStage) : stage));
    }, [user]);

    const deleteStage = useCallback(async (id: string) => {
        if (!user) throw new Error("User not authenticated.");
        const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
        if (error) throw error;
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