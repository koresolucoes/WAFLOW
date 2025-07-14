
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { executeAutomation } from './_lib/engine';
import { Automation, Contact } from '../../types';

// Helper to find a contact by phone and create if not exists
const findOrCreateContact = async (user_id: string, phone: string, name: string): Promise<Contact | null> => {
    let { data: contact, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', user_id)
        .eq('phone', phone)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
        const { data: newContact, error: insertError } = await supabaseAdmin
            .from('contacts')
            .insert({ user_id, phone, name, tags: ['new-lead'] })
            .select()
            .single();
        if (insertError) return null;
        contact = newContact;
    } else if (error) {
        return null;
    }
    return contact as Contact;
};

// Helper to find automations to trigger based on message content
const findAutomationsToTrigger = async (user_id: string, messageBody: string, buttonPayload?: string): Promise<{automation: Automation, startNodeId: string}[]> => {
    const { data: automations, error } = await supabaseAdmin
        .from('automations')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active');

    if (error || !automations) return [];

    const triggers: {automation: Automation, startNodeId: string}[] = [];

    for (const auto of (automations as unknown as Automation[])) {
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
        // 2a. Verify Signature
        const signature = req.headers['x-hub-signature-256'] as string;
        const appSecret = process.env.META_APP_SECRET;

        if (!appSecret) {
            console.error("META_APP_SECRET is not set. Cannot verify webhook signature.");
            return res.status(500).send('Server configuration error.');
        }

        const hmac = crypto.createHmac('sha256', appSecret);
        hmac.update(JSON.stringify(req.body));
        const expectedSignature = `sha256=${hmac.digest('hex')}`;

        if (signature !== expectedSignature) {
            console.warn('Invalid webhook signature.');
            return res.status(403).send('Invalid signature.');
        }

        // 2b. Process Webhook Body
        const { entry } = req.body;
        if (!entry || !Array.isArray(entry)) {
            return res.status(400).send('Invalid payload');
        }

        for (const item of entry) {
            for (const change of item.changes) {
                const { field, value } = change;

                if (field !== 'messages') continue;
                
                // ---- STATUS UPDATES ----
                if (value.statuses) {
                    for (const status of value.statuses) {
                        const { message_id, status: newStatus, timestamp } = status;
                        const updateData: any = { status: newStatus };
                        if (newStatus === 'delivered') updateData.delivered_at = new Date(timestamp * 1000).toISOString();
                        if (newStatus === 'read') updateData.read_at = new Date(timestamp * 1000).toISOString();
                        
                        await supabaseAdmin
                            .from('campaign_messages')
                            .update(updateData)
                            .eq('meta_message_id', message_id);
                    }
                }

                // ---- INCOMING MESSAGES ----
                if (value.messages) {
                    for (const message of value.messages) {
                        const wabaId = value.metadata.phone_number_id;
                        const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('meta_phone_number_id', wabaId).single();

                        if (!profile) continue;

                        const contact = await findOrCreateContact(profile.id, message.from, value.contacts[0].profile.name);
                        if (!contact) continue;

                        let messageBody = '';
                        let buttonPayload: string | undefined = undefined;

                        if (message.type === 'text') messageBody = message.text.body;
                        if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                            messageBody = message.interactive.button_reply.title;
                            buttonPayload = message.interactive.button_reply.id;
                        }

                        // Store received message
                        await supabaseAdmin.from('received_messages').insert({
                           user_id: profile.id,
                           contact_id: contact.id,
                           meta_message_id: message.id,
                           message_body: messageBody
                        });
                        
                        // Find and run automations
                        const automationsToRun = await findAutomationsToTrigger(profile.id, messageBody, buttonPayload);
                        for(const { automation, startNodeId } of automationsToRun) {
                            await executeAutomation(automation, contact, startNodeId, { message });
                        }
                    }
                }
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(405).send('Method Not Allowed');
}
