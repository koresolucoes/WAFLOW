import { supabaseAdmin } from '../supabaseAdmin.js';
import { findOrCreateContactByPhone } from './contact-mapper.js';
import { publishEvent } from '../automation/trigger-handler.js';
import { TablesInsert } from '../database.types.js';

export async function processIncomingMessage(
    userId: string, 
    message: any, 
    contactsPayload: any
): Promise<void> {
    const contactName = contactsPayload?.[0]?.profile?.name || 'Contato via WhatsApp';
    const { contact, isNew } = await findOrCreateContactByPhone(userId, message.from, contactName);

    if (!contact) {
        // Error is thrown inside findOrCreateContactByPhone, so this is a safeguard.
        console.error(`[Message Handler] Could not find or create contact for phone ${message.from}. Aborting message processing.`);
        return;
    }

    let messageBody = `[${message.type}]`;
    if (message.type === 'text' && message.text?.body) {
        messageBody = message.text.body;
    } else if (message.type === 'interactive' && message.interactive?.button_reply) {
        messageBody = `Botão Clicado: "${message.interactive.button_reply.title}"`;
    } else if (message.type === 'button' && message.button?.text) {
         messageBody = `Botão de Template Clicado: "${message.button.text}"`;
    }

    const messagePayload: TablesInsert<'messages'> = {
        user_id: userId,
        contact_id: contact.id,
        meta_message_id: message.id,
        content: messageBody,
        type: 'inbound',
        source: 'inbound_reply',
        status: 'read', // Inbound messages are implicitly read by the system
        read_at: new Date().toISOString()
    };

    const { error: insertError } = await supabaseAdmin.from('messages').insert(messagePayload as any);

    if (insertError) {
        console.error(`[Message Handler] Failed to insert inbound message for contact ${contact.id}:`, insertError);
        throw insertError; // Propagate the error
    }

    console.log(`[Message Handler] Message from ${contact.name} saved. Firing automation events.`);

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
}
