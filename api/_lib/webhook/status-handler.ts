

import { supabaseAdmin } from '../supabaseAdmin.js';
import { TablesUpdate } from '../database.types.js';

export async function processStatusUpdate(status: any): Promise<void> {
    console.log(`[Manipulador de Status] Processando atualização de status para a mensagem ${status.id}: ${status.status}`);
    try {
        const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
        if (!['sent', 'delivered', 'read', 'failed'].includes(newStatus)) {
            console.warn(`[Manipulador de Status] Ignorado tipo de status desconhecido: ${newStatus}`);
            return;
        }
        
        const timestamp = new Date(parseInt(status.timestamp, 10) * 1000).toISOString();

        const baseUpdate: {
            status: string;
            delivered_at?: string;
            read_at?: string;
            error_message?: string;
        } = {
            status: newStatus,
        };

        if (newStatus === 'delivered') {
            baseUpdate.delivered_at = timestamp;
        } else if (newStatus === 'read') {
            baseUpdate.read_at = timestamp;
            baseUpdate.delivered_at = baseUpdate.delivered_at || timestamp;
        } else if (newStatus === 'failed' && status.errors) {
            baseUpdate.error_message = `${status.errors[0]?.title} (Código: ${status.errors[0]?.code})`;
        }

        const { error: campaignError } = await supabaseAdmin.from('campaign_messages').update(baseUpdate as TablesUpdate<'campaign_messages'>).eq('meta_message_id', status.id);
        const { error: sentError } = await supabaseAdmin.from('sent_messages').update(baseUpdate as TablesUpdate<'sent_messages'>).eq('meta_message_id', status.id);

        if (campaignError) console.error(`[Manipulador de Status] Erro ao atualizar campaign_messages para ${status.id}:`, campaignError.message);
        if (sentError) console.error(`[Manipulador de Status] Erro ao atualizar sent_messages para ${status.id}:`, sentError.message);

    } catch (e: any) {
        console.error(`[Manipulador de Status] FATAL: Falha ao processar atualização de status para a mensagem ${status.id}:`, e.message);
    }
}