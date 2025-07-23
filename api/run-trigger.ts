

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { publishEvent } from './_lib/automation/trigger-handler.js';
import { Contact } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { eventType, userId, contactId, data } = req.body;

    if (!eventType || !userId || !contactId) {
        return res.status(400).json({ error: 'Missing required fields: eventType, userId, contactId' });
    }
    
    const { data: contactData, error } = await supabaseAdmin.from('contacts').select('*').eq('id', contactId).eq('user_id', userId).single();
    if (error || !contactData) {
        return res.status(404).json({ error: 'Contact not found or access denied.' });
    }
    const contact = contactData as unknown as Contact;

    try {
        switch (eventType) {
            case 'contact_created':
                // Publica um evento genérico de que um contato foi criado
                await publishEvent('contact_created', userId, { contact });

                // Publica também eventos para cada uma das tags do novo contato
                if (contact.tags && contact.tags.length > 0) {
                    // Use Promise.all to run tag triggers concurrently but wait for all
                    await Promise.all(
                        contact.tags.map(tag => publishEvent('tag_added', userId, { contact, tag }))
                    );
                }
                break;

            case 'tags_added':
                if (!data || !Array.isArray(data.addedTags)) {
                    return res.status(400).json({ error: 'Missing data.addedTags for this event type' });
                }
                 // Use Promise.all to run tag triggers concurrently but wait for all
                await Promise.all(
                    data.addedTags.map((tag: string) => publishEvent('tag_added', userId, { contact, tag }))
                );
                break;

            default:
                return res.status(400).json({ error: `Unsupported eventType: ${eventType}` });
        }
        
        // Retorna 200 OK para indicar que o evento foi processado com sucesso.
        return res.status(200).json({ message: 'Triggers executed successfully.' });
    } catch(err: any) {
        console.error('Error in run-trigger handler:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
