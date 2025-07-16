

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleTagAddedEvent, handleNewContactEvent } from './_lib/automation/trigger-handler.js';
import { Contact } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { triggerType, userId, contactId, data } = req.body;

    if (!triggerType || !userId || !contactId) {
        return res.status(400).json({ error: 'Missing required fields: triggerType, userId, contactId' });
    }
    
    // In a real-world scenario, you might want to verify that the request comes from an authenticated user session.
    // For this internal API, we'll trust the caller for now.
    
    const { data: contactData, error } = await supabaseAdmin.from('contacts').select('*').eq('id', contactId).eq('user_id', userId).single();
    if (error || !contactData) {
        return res.status(404).json({ error: 'Contact not found or access denied.' });
    }
    const contact = contactData as unknown as Contact;

    try {
        switch (triggerType) {
            case 'new_contact_with_tag':
                if (!data || !data.addedTag) {
                    return res.status(400).json({ error: 'Missing data.addedTag for this trigger type' });
                }
                // Don't await, let it run in the background
                handleTagAddedEvent(userId, contact, data.addedTag);
                break;
            case 'new_contact':
                // Don't await
                handleNewContactEvent(userId, contact);
                break;
            default:
                return res.status(400).json({ error: 'Unsupported trigger type' });
        }
        
        return res.status(202).json({ message: 'Trigger processing initiated.' });
    } catch(err: any) {
        console.error('Error in run-trigger handler:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
