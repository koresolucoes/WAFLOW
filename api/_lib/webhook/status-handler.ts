import { supabaseAdmin } from '../supabaseAdmin.js';
import { TablesUpdate } from '../database.types.js';

export async function processStatusUpdate(status: any): Promise<void> {
    console.log(`[Status Handler] Processing status update for message ${status.id}: ${status.status}`);
    try {
        const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
        if (!['sent', 'delivered', 'read', 'failed'].includes(newStatus)) {
            console.warn(`[Status Handler] Ignoring unknown status type: ${newStatus}`);
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
            // A message can only be read if it was delivered.
            baseUpdate.delivered_at = baseUpdate.delivered_at || timestamp; 
        } else if (newStatus === 'failed' && status.errors) {
            baseUpdate.error_message = `${status.errors[0]?.title} (Code: ${status.errors[0]?.code})`;
        }

        const { error } = await supabaseAdmin
            .from('messages')
            .update(baseUpdate as any)
            .eq('meta_message_id', status.id);

        if (error) {
            console.error(`[Status Handler] Error updating message table for ${status.id}:`, error.message);
        }

    } catch (e: any) {
        console.error(`[Status Handler] FATAL: Failed to process status update for message ${status.id}:`, e.message);
    }
}