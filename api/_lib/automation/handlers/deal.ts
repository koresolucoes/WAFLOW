import { supabaseAdmin } from '../../supabaseAdmin.js';
import { ActionHandler } from '../types.js';
import { resolveVariables } from '../helpers.js';
import { TablesInsert } from '../../database.types.js';
import { publishEvent } from '../trigger-handler.js';

export const createDeal: ActionHandler = async ({ profile, contact, node, trigger, teamId }) => {
    if (!contact) {
        throw new Error('Ação "Criar Negócio" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (!config.deal_name || !config.pipeline_id || !config.stage_id) {
        throw new Error('Configuração incompleta para criar negócio: nome, funil e etapa são obrigatórios.');
    }

    const context = { contact, trigger };
    const dealName = resolveVariables(config.deal_name, context);
    const dealValue = config.deal_value ? parseFloat(resolveVariables(config.deal_value, context)) : 0;

    const dealPayload: TablesInsert<'deals'> = {
        name: dealName,
        value: isNaN(dealValue) ? 0 : dealValue,
        pipeline_id: config.pipeline_id,
        stage_id: config.stage_id,
        contact_id: contact.id,
        team_id: teamId,
        status: 'Aberto'
    };

    const { data: newDeal, error } = await supabaseAdmin.from('deals').insert(dealPayload as any).select('*').single();

    if (error) {
        console.error("Erro ao criar negócio via automação:", error);
        throw error;
    }
    
    // Dispara o evento de "deal_created" para que outros gatilhos possam reagir
    await publishEvent('deal_created', profile.id, { contact, deal: newDeal });

    return { details: `Negócio "${dealName}" criado com sucesso.` };
};

export const updateDealStage: ActionHandler = async ({ profile, contact, node }) => {
    if (!contact) {
        throw new Error('Ação "Atualizar Etapa do Negócio" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (!config.stage_id) {
        throw new Error('Nenhuma etapa de destino foi selecionada.');
    }
    
    // Lógica para encontrar o negócio mais recente do contato que ainda está 'Aberto'
    const { data: latestDeal, error: dealError } = await supabaseAdmin
        .from('deals')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('status', 'Aberto')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (dealError || !latestDeal) {
        return { details: 'Nenhum negócio aberto encontrado para este contato. Nenhuma ação executada.' };
    }
    
    const { data: targetStage, error: stageError } = await supabaseAdmin
        .from('pipeline_stages')
        .select('type')
        .eq('id', config.stage_id)
        .single();

    if (stageError) throw stageError;

    const updatePayload: any = { stage_id: config.stage_id };
    if (targetStage.type === 'Ganho' || targetStage.type === 'Perdido') {
        updatePayload.status = targetStage.type;
        updatePayload.closed_at = new Date().toISOString();
    }
    
    const { data: updatedDeal, error: updateError } = await supabaseAdmin
        .from('deals')
        .update(updatePayload as any)
        .eq('id', latestDeal.id)
        .select('*')
        .single();
    
    if (updateError) {
        console.error(`Erro ao atualizar etapa do negócio ${latestDeal.id}:`, updateError);
        throw updateError;
    }

    // Dispara o evento de "deal_stage_changed"
    await publishEvent('deal_stage_changed', profile.id, { contact, deal: updatedDeal, new_stage_id: config.stage_id });

    return { details: `Negócio "${latestDeal.name}" movido para a nova etapa.` };
};