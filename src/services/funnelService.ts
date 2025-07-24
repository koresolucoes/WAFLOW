import { supabase } from '../lib/supabaseClient';
import { Pipeline, PipelineStage, DealInsert, DealWithContact } from '../types';
import { TablesInsert } from '../types/database.types';

export const addDealToDb = async (dealData: DealInsert): Promise<DealWithContact> => {
    const { data, error } = await supabase.from('deals').insert(dealData).select('*, contacts(id, name)').single();
    if (error) throw error;
    return data as DealWithContact;
};

export const updateDealStageInDb = async (dealId: string, newStageId: string): Promise<DealWithContact> => {
    const { data, error } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId).select('*, contacts(id, name)').single();
    if (error) throw error;
    return data as DealWithContact;
};

export const createDefaultPipelineInDb = async (userId: string): Promise<{ pipeline: Pipeline, stages: PipelineStage[] }> => {
    const { data: pipelineData, error: pipelineError } = await supabase.from('pipelines').insert({ user_id: userId, name: 'Funil de Vendas Padrão' }).select('*').single();
    if (pipelineError || !pipelineData) throw pipelineError || new Error("Falha ao criar funil.");
    
    const pipeline = pipelineData;
    const defaultStages = [ { name: 'Novo Lead', sort_order: 0 }, { name: 'Contato Feito', sort_order: 1 }, { name: 'Proposta Enviada', sort_order: 2 }, { name: 'Negociação', sort_order: 3 }, { name: 'Ganhos', sort_order: 4 }, { name: 'Perdidos', sort_order: 5 } ];
    const stagesToInsert: TablesInsert<'pipeline_stages'>[] = defaultStages.map(stage => ({ ...stage, pipeline_id: pipeline.id }));
    const { data: stagesData, error: stagesError } = await supabase.from('pipeline_stages').insert(stagesToInsert).select();

    if (stagesError || !stagesData) {
        await supabase.from('pipelines').delete().eq('id', pipeline.id);
        throw stagesError || new Error("Falha ao criar etapas.");
    }
    
    return { pipeline, stages: stagesData };
};

export const addPipelineToDb = async (userId: string, name: string): Promise<{ pipeline: Pipeline, stage: PipelineStage }> => {
    const { data: pipelineData, error } = await supabase.from('pipelines').insert({ user_id: userId, name }).select('*').single();
    if (error || !pipelineData) throw error || new Error("Falha ao criar funil.");

    const pipeline = pipelineData;
    const stagePayload: TablesInsert<'pipeline_stages'> = { name: 'Nova Etapa', sort_order: 0, pipeline_id: pipeline.id };
    const { data: stageData, error: stageError } = await supabase.from('pipeline_stages').insert(stagePayload).select().single();
    if (stageError || !stageData) throw stageError || new Error("Falha ao criar etapa inicial.");

    return { pipeline, stage: stageData };
};

export const updatePipelineInDb = async (id: string, name: string): Promise<Pipeline> => {
    const { data, error } = await supabase.from('pipelines').update({ name }).eq('id', id).select('*').single();
    if (error || !data) throw error || new Error("Falha ao renomear funil.");
    return data;
};

export const deletePipelineFromDb = async (id: string): Promise<void> => {
    const { error } = await supabase.from('pipelines').delete().eq('id', id);
    if (error) throw error;
};

export const addStageToDb = async (pipelineId: string, sortOrder: number): Promise<PipelineStage> => {
    const newStagePayload: TablesInsert<'pipeline_stages'> = {
        pipeline_id: pipelineId,
        name: 'Nova Etapa',
        sort_order: sortOrder,
    };
    const { data, error } = await supabase.from('pipeline_stages').insert(newStagePayload).select('*').single();
    if (error || !data) throw error || new Error("Falha ao adicionar etapa.");
    return data;
};

export const updateStageInDb = async (id: string, name: string): Promise<PipelineStage> => {
    const { data, error } = await supabase.from('pipeline_stages').update({ name }).eq('id', id).select('*').single();
    if (error || !data) throw error || new Error("Falha ao renomear etapa.");
    return data;
};

export const deleteStageFromDb = async (id: string): Promise<void> => {
    const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
    if (error) throw error;
};