
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { Profile, TablesUpdate } from '../_lib/types.js';
import { publishEvent } from '../_lib/automation/trigger-handler.js';
import { findOrCreateContactByPhone } from '../_lib/webhook/contact-mapper.js';


const processStatusUpdate = async (status: any) => {
    console.log(`[STATUS] Processing status update for message ${status.id}: ${status.status}`);
    try {
        const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'
        if (!['sent', 'delivered', 'read', 'failed'].includes(newStatus)) {
            console.warn(`[STATUS] Ignored unknown status type: ${newStatus}`);
            return;
        }
        
        const timestamp = new Date(parseInt(status.timestamp, 10) * 1000).toISOString();

        const baseUpdate: Partial<TablesUpdate<'campaign_messages' | 'sent_messages'>> = {
            status: newStatus,
        };

        if (newStatus === 'delivered') {
            baseUpdate.delivered_at = timestamp;
        } else if (newStatus === 'read') {
            // If a message is read, it must have been delivered.
            // This handles cases where the 'delivered' webhook is missed or arrives out of order.
            baseUpdate.read_at = timestamp;
            baseUpdate.delivered_at = baseUpdate.delivered_at || timestamp;
        } else if (newStatus === 'failed' && status.errors) {
            baseUpdate.error_message = `${status.errors[0]?.title} (Code: ${status.errors[0]?.code})`;
        }

        // Attempt to update both tables. One of them will match the message ID.
        // This is safe because meta_message_id is unique across the user's messages.
        const { error: campaignError } = await supabaseAdmin.from('campaign_messages').update(baseUpdate as any).eq('meta_message_id', status.id);
        const { error: sentError } = await supabaseAdmin.from('sent_messages').update(baseUpdate as any).eq('meta_message_id', status.id);

        if (campaignError) console.error(`[STATUS] Error updating campaign_messages for ${status.id}:`, campaignError.message);
        if (sentError) console.error(`[STATUS] Error updating sent_messages for ${status.id}:`, sentError.message);

    } catch (e: any) {
        console.error(`[STATUS] FATAL: Failed to process status update for message ${status.id}:`, e.message);
    }
};

const processIncomingMessage = async (userId: string, message: any, contactsPayload: any) => {
    try {
        const contactName = contactsPayload?.[0]?.profile?.name || 'Contato via WhatsApp';
        const { contact, isNew } = await findOrCreateContactByPhone(userId, message.from, contactName);

        if (!contact) {
            console.error(`[ERROR] Could not find or create contact for phone ${message.from}.`);
            return;
        }

        let messageBody = `[${message.type}]`;
        if (message.type === 'text' && message.text?.body) {
            messageBody = message.text.body;
        } else if (message.type === 'interactive' && message.interactive?.button_reply) {
            messageBody = `Botão Clicado: "${message.interactive.button_reply.title}"`;
        }

        const { error: insertError } = await supabaseAdmin.from('received_messages').insert({
            user_id: userId,
            contact_id: contact.id,
            meta_message_id: message.id,
            message_body: messageBody
        } as any);

        if (insertError) {
            console.error(`[ERROR] Failed to insert received message for contact ${contact.id}:`, insertError);
            return;
        }

        // Publish events for automations and other side effects
        await publishEvent('message_received', userId, { contact, message });
        if (isNew) {
            await publishEvent('contact_created', userId, { contact });
            if (contact.tags && contact.tags.length > 0) {
                await Promise.all(
                    contact.tags.map(tag => publishEvent('tag_added', userId, { contact, tag }))
                );
            }
        }
    } catch (e: any) {
        console.error(`[ERROR] General failure in message processing for message ID ${message.id}:`, e.message, e.stack);
    }
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
        const { id: userId } = req.query;
        if (typeof userId !== 'string' || !userId) {
            console.error("[ERROR] Webhook request received without a user ID in the URL.");
            return res.status(400).send('Invalid User ID in webhook URL');
        }

        console.log(`[LOG] Webhook payload received for user: ${userId}`);
        const { entry } = req.body;
        if (!entry || !Array.isArray(entry)) {
            console.error("Invalid payload: 'entry' not found or not an array.");
            return res.status(400).send('Invalid payload');
        }

        // Respond immediately to Meta to avoid timeouts
        res.status(200).send('EVENT_RECEIVED');

        // Fetch user profile once to validate and use for all messages in this batch
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error(`[ERROR] Profile not found for user_id: ${userId}. Webhook URL may be incorrect.`);
            return; // Stop all processing if the user profile is invalid
        }
        
        try {
            const promises: Promise<void>[] = [];
            for (const item of entry) {
                for (const change of item.changes) {
                    const { field, value } = change;
                    if (field !== 'messages') continue;

                    // Handle Status Updates
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            promises.push(processStatusUpdate(status));
                        }
                    }

                    // Handle Incoming Messages
                    if (value.messages) {
                        const incomingPhoneNumberId = value?.metadata?.phone_number_id;
                        if ((profile as Profile).meta_phone_number_id !== String(incomingPhoneNumberId)) {
                             console.warn(`[WARN] Incoming phone_number_id (${incomingPhoneNumberId}) does not match the one configured for user ${userId}. Processing anyway.`);
                        }
                        
                        for (const message of value.messages) {
                            promises.push(processIncomingMessage(userId, message, value.contacts));
                        }
                    }
                }
            }

            // Process all notifications concurrently
            await Promise.all(promises);
            console.log(`[LOG] Webhook processing batch for user ${userId} completed.`);

        } catch (error: any) {
            console.error("[FATAL] Unhandled error during webhook processing:", error.message, error.stack);
        }
        
        return;
    }

    return res.status(405).send('Method Not Allowed');
}