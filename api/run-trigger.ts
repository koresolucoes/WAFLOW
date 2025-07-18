
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { handleNewContactEvent, handleTagAddedEvent } from './_lib/automation/trigger-handler.js';
import { Contact } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { triggerType, userId, contactId, data } = req.body;

    if (!triggerType || !userId || !contactId) {
        return res.status(400).json({ error: 'Missing required fields: triggerType, userId, contactId' });
    }
    
    const { data: contactData, error } = await supabaseAdmin.from('contacts').select('*').eq('id', contactId).eq('user_id', userId).single();
    if (error || !contactData) {
        return res.status(404).json({ error: 'Contact not found or access denied.' });
    }
    const contact = contactData as unknown as Contact;

    try {
        switch (triggerType) {
            case 'new_contact':
                // This is the primary entry point for a contact creation event from the frontend.
                // It handles both the generic 'new_contact' trigger and any tag-based triggers for initial tags.
                handleNewContactEvent(userId, contact);
                if (contact.tags && contact.tags.length > 0) {
                    for (const tag of contact.tags) {
                        handleTagAddedEvent(userId, contact, tag);
                    }
                }
                break;
            case 'tag_added_to_existing_contact':
                if (!data || !data.addedTag) {
                    return res.status(400).json({ error: 'Missing data.addedTag for this trigger type' });
                }
                // This is specifically for when a tag is added to an already existing contact.
                handleTagAddedEvent(userId, contact, data.addedTag);
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
