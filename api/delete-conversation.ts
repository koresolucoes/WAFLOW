import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { contactId } = req.body;

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
        
        // Delete associated messages
        const { error: messagesError } = await supabaseAdmin
            .from('messages')
            .delete()
            .eq('team_id', teamId)
            .eq('contact_id', contactId);
        
        if (messagesError) throw messagesError;

        // Delete conversation record
        const { error: conversationError } = await supabaseAdmin
            .from('conversations')
            .delete()
            .eq('team_id', teamId)
            .eq('contact_id', contactId);

        if (conversationError) throw conversationError;

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Error in delete-conversation function:', error);
        return res.status(500).json({ error: error.message });
    }
}
