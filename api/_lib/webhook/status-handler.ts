import { supabaseAdmin } from '../supabaseAdmin.js';
import { TablesUpdate } from '../database.types.js';

export async function processStatusUpdate(status: any, userId: string): Promise<void> {
    console.log(`[Status Handler] Processing status update for message ${status.id} for user ${userId}: ${status.status}`);
    
    const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
    if (!['sent', 'delivered', 'read', 'failed'].includes(newStatus)) {
        console.warn(`[Status Handler] Ignoring unknown status type: ${newStatus}`);
        return;
    }
    
    const timestamp = new Date(parseInt(status.timestamp, 10) * 1000).toISOString();

    const updatePayload: TablesUpdate<'messages'> = {
        status: newStatus,
    };

    if (newStatus === 'delivered') {
        updatePayload.delivered_at = timestamp;
    } else if (newStatus === 'read') {
        updatePayload.read_at = timestamp;
        // A message can only be read if it was delivered.
        updatePayload.delivered_at = timestamp; 
    } else if (newStatus === 'failed' && status.errors) {
        updatePayload.error_message = `${status.errors[0]?.title} (Code: ${status.errors[0]?.code})`;
    }

    const { data, error } = await supabaseAdmin
        .from('messages')
        .update(updatePayload)
        .eq('meta_message_id', status.id)
        .eq('user_id', userId)
        .select('id');

    if (error) {
        console.error(`[Status Handler] Error updating message table for ${status.id}:`, error.message);
        throw error; // Propagate the error
    } else if (!data || data.length === 0) {
        console.warn(`[Status Handler] No message found with meta_message_id ${status.id} for user ${userId}. Update was not applied.`);
    } else {
        console.log(`[Status Handler] Successfully updated status for message(s): ${data.map((d: any) => d.id).join(', ')}`);
    }
}
