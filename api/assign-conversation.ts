import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { contactId, assigneeId } = req.body;

        if (!contactId) {
            return res.status(400).json({ error: 'contactId is required.' });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization header is missing or malformed.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { data: contactData, error: contactError } = await supabaseAdmin
            .from('contacts')
            .select('team_id')
            .eq('id', contactId)
            .single();
            
        if (contactError || !contactData) {
            return res.status(404).json({ error: 'Contact not found.' });
        }
        const teamId = contactData.team_id;

        const { count: memberCount, error: memberError } = await supabaseAdmin
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('team_id', teamId);

        if (memberError || memberCount === 0) {
            return res.status(403).json({ error: 'Access denied to this team.' });
        }
        
        // Using select-then-insert/update as upsert might fail without a unique constraint
        const { data: existingConversation, error: selectError } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('team_id', teamId)
            .eq('contact_id', contactId)
            .maybeSingle();

        if (selectError) throw selectError;

        if (existingConversation) {
            const { error: updateError } = await supabaseAdmin
                .from('conversations')
                .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() } as any)
                .eq('id', existingConversation.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseAdmin
                .from('conversations')
                .insert({
                    team_id: teamId,
                    contact_id: contactId,
                    assignee_id: assigneeId,
                    status: 'open',
                } as any);
            if (insertError) throw insertError;
        }

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Error in assign-conversation function:', error);
        return res.status(500).json({ error: error.message });
    }
}
