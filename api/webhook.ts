

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { executeAutomation } from './_lib/engine.js';
import { Automation, Contact, TablesInsert } from './_lib/types.js';

// Helper to find a contact by phone and create if not exists
const findOrCreateContact = async (user_id: string, phone: string, name: string): Promise<Contact | null> => {
    let { data: contactData, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', user_id)
        .eq('phone', phone)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
        const { data: newContact, error: insertError } = await supabaseAdmin
            .from('contacts')
            .insert({ user_id, phone, name, tags: ['new-lead'] } as TablesInsert<'contacts'>)
            .select()
            .single();
        if (insertError || !newContact) {
             console.error("Error creating new contact:", insertError);
             return null;
        }
        contactData = newContact;
    } else if (error) {
         console.error("Error finding contact:", error);
        return null;
    }
    return contactData as Contact;
};

// Helper to find automations to trigger based on message content
const findAutomationsToTrigger = async (user_id: string, messageBody: string, buttonPayload?: string): Promise<{automation: Automation, startNodeId: string}[]> => {
    const { data, error } = await supabaseAdmin
        .from('automations')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active');

    if (error) {
        console.error("Error fetching automations:", error);
        return [];
    }
    const automations = data as Automation[] | null;
    if (!automations) return [];

    const triggers: {automation: Automation, startNodeId: string}[] = [];

    for (const auto of automations) {
        if (!auto.nodes) continue;
        for (const node of auto.nodes) {
            const config = (node.data.config || {}) as any;
            if (buttonPayload && node.data.type === 'button_clicked' && config.button_payload === buttonPayload) {
                triggers.push({ automation: auto, startNodeId: node.id });
            }
            if (messageBody && node.data.type === 'message_received_with_keyword' && messageBody.toLowerCase().includes(config.keyword?.toLowerCase())) {
                 triggers.push({ automation: auto, startNodeId: node.id });
            }
        }
    }
    return triggers;
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
        // 2b. Process Webhook Body
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
                            const { recipient_id, ...statusUpdate } = status;
                            const newStatus = statusUpdate.status;
                            const updateData: any = { status: newStatus };
                            if (newStatus === 'delivered') updateData.delivered_at = new Date(statusUpdate.timestamp * 1000).toISOString();
                            if (newStatus === 'read') updateData.read_at = new Date(statusUpdate.timestamp * 1000).toISOString();
                            
                            await supabaseAdmin
                                .from('campaign_messages')
                                .update(updateData)
                                .eq('meta_message_id', statusUpdate.id);
                        }
                    }

                    // ---- INCOMING MESSAGES ----
                    if (value.messages) {
                        for (const message of value.messages) {
                            const wabaId = value.metadata.phone_number_id;
                            const { data: profileData, error: profileError } = await supabaseAdmin.from('profiles').select('id').eq('meta_phone_number_id', wabaId).single();
                            
                            if (profileError || !profileData) continue;
                            const profile = profileData;

                            const contact = await findOrCreateContact(profile.id, message.from, value.contacts[0].profile.name);
                            if (!contact) continue;

                            let messageBody = '';
                            let buttonPayload: string | undefined = undefined;

                            if (message.type === 'text') {
                                messageBody = message.text.body;
                            } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                                messageBody = message.interactive.button_reply.title;
                                buttonPayload = message.interactive.button_reply.id;
                            } else {
                                // Potentially handle other message types like image, audio, etc.
                                messageBody = `[${message.type}]`;
                            }

                            // Store received message
                            await supabaseAdmin.from('received_messages').insert({
                               user_id: profile.id,
                               contact_id: contact.id,
                               meta_message_id: message.id,
                               message_body: messageBody
                            } as TablesInsert<'received_messages'>);
                            
                            // Find and run automations
                            const automationsToRun = await findAutomationsToTrigger(profile.id, messageBody, buttonPayload);
                            for(const { automation, startNodeId } of automationsToRun) {
                                // Don't await this so we can return a 200 to Meta quickly
                                executeAutomation(automation, contact, startNodeId, { message });
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
