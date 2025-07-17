






import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { Contact, Profile, Tables } from './_lib/types.js';
import { TablesInsert, TablesUpdate } from './_lib/database.types.js';
import { handleMetaMessageEvent, handleNewContactEvent } from './_lib/automation/trigger-handler.js';

// Helper to find a contact by phone and create if not exists
const findOrCreateContact = async (user_id: string, phone: string, name: string): Promise<{ contact: Contact | null, isNew: boolean }> => {
    let { data: contactData, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', user_id)
        .eq('phone', phone)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
        const newContactPayload: TablesInsert<'contacts'> = { user_id, phone, name, tags: ['new-lead'], custom_fields: null };
        const { data: newContact, error: insertError } = await supabaseAdmin
            .from('contacts')
            .insert(newContactPayload as any)
            .select()
            .single();
        if (insertError || !newContact) {
             console.error("Error creating new contact:", insertError);
             return { contact: null, isNew: false };
        }
        return { contact: newContact as Contact, isNew: true };
    } else if (error) {
         console.error("Error finding contact:", error);
        return { contact: null, isNew: false };
    }
    return { contact: contactData as Contact, isNew: false };
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Handle Verification Request from Meta
    if (req.method === 'GET') {
        const verifyToken = process.env.META_VERIFY_TOKEN;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('Webhook verified successfully!');
            return res.status(200).send(challenge);
        } else {
            console.error('Failed webhook verification. Make sure META_VERIFY_TOKEN is set.');
            return res.status(403).send('Forbidden');
        }
    }

    // 2. Handle Event Notifications from Meta
    if (req.method === 'POST') {
        const { entry } = req.body;
        if (!entry || !Array.isArray(entry)) {
            return res.status(400).send('Invalid payload');
        }

        try {
            for (const item of entry) {
                for (const change of item.changes) {
                    const { field, value } = change;

                    if (field !== 'messages') continue;
                    
                    // ---- STATUS UPDATES ----
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            const newStatus = status.status;
                            const updateData: TablesUpdate<'campaign_messages'> = { status: newStatus };
                            if (newStatus === 'delivered') updateData.delivered_at = new Date(status.timestamp * 1000).toISOString();
                            if (newStatus === 'read') updateData.read_at = new Date(status.timestamp * 1000).toISOString();
                            
                            await supabaseAdmin
                                .from('campaign_messages')
                                .update(updateData as any)
                                .eq('meta_message_id', status.id);
                        }
                    }

                    // ---- INCOMING MESSAGES ----
                    if (value.messages) {
                        for (const message of value.messages) {
                            const wabaId = value.metadata.phone_number_id;
                            const { data: profileData, error: profileError } = await supabaseAdmin.from('profiles').select('id').eq('meta_phone_number_id', wabaId).single();
                            
                            if (profileError || !profileData) continue;
                            const userId = (profileData as Tables<'profiles'>).id;

                            const { contact, isNew } = await findOrCreateContact(userId, message.from, value.contacts[0].profile.name);
                            if (!contact) continue;

                            let messageBody = '';
                            if (message.type === 'text') {
                                messageBody = message.text.body;
                            } else if (message.type === 'interactive') {
                                messageBody = `[${message.type}]`;
                            } else {
                                messageBody = `[${message.type}]`;
                            }
                            
                            const receivedMessagePayload: TablesInsert<'received_messages'> = {
                               user_id: userId,
                               contact_id: contact.id,
                               meta_message_id: message.id,
                               message_body: messageBody
                            };
                            // Store received message
                            await supabaseAdmin.from('received_messages').insert(receivedMessagePayload as any);
                            
                            // ---- NEW: Use centralized trigger handler ----
                            // Don't await these, let them run in the background
                            handleMetaMessageEvent(userId, contact, message);
                            if (isNew) {
                                handleNewContactEvent(userId, contact);
                            }
                        }
                    }
                }
            }
        } catch(error: any) {
            console.error("Error processing webhook:", error.message);
            // Still return 200 to Meta to prevent retries for malformed but acknowledged events
        }
        
        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(405).send('Method Not Allowed');
}
