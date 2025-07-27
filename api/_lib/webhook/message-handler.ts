import { supabaseAdmin } from '../supabaseAdmin.js';
import { findOrCreateContactByPhone } from './contact-mapper.js';
import { publishEvent } from '../automation/trigger-handler.js';
import { TablesInsert } from '../database.types.js';

const analyzeAndStoreSentiment = async (messageText: string, contactId: string): Promise<void> => {
    // Evita analisar mensagens muito curtas ou não textuais
    if (!messageText || messageText.trim().length < 5 || messageText.startsWith('[')) {
        return;
    }

    try {
        const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const response = await fetch(`${host}/api/analyze-sentiment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageText }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Sentiment analysis API failed with status ${response.status}: ${errorBody}`);
        }

        const { emoji } = await response.json();

        if (emoji && typeof emoji === 'string') {
            const { error: updateError } = await supabaseAdmin
                .from('contacts')
                .update({ sentiment: emoji } as any)
                .eq('id', contactId);
            
            if (updateError) {
                console.error(`[Message Handler] Failed to update sentiment for contact ${contactId}:`, updateError);
            } else {
                console.log(`[Message Handler] Updated sentiment for contact ${contactId} to ${emoji}`);
            }
        }
    } catch (error) {
        console.error(`[Message Handler] Sentiment analysis process failed for contact ${contactId}:`, error);
    }
};

export async function processIncomingMessage(
    userId: string, 
    message: any, 
    contactsPayload: any
): Promise<void> {
    const { data: teamData, error: teamError } = await supabaseAdmin.from('teams').select('id').eq('owner_id', userId).single();
    if (teamError || !teamData) {
        console.error(`[Message Handler] Could not find team for user ${userId}. Aborting message processing.`);
        return;
    }
    const teamId = teamData.id;

    const contactName = contactsPayload?.[0]?.profile?.name || 'Contato via WhatsApp';
    const { contact, isNew } = await findOrCreateContactByPhone(teamId, message.from, contactName);

    if (!contact) {
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
        team_id: teamId,
        contact_id: contact.id,
        meta_message_id: message.id,
        content: messageBody,
        type: 'inbound',
        source: 'inbound_reply',
        status: 'read', 
        read_at: new Date().toISOString()
    };

    const { error: insertError } = await supabaseAdmin.from('messages').insert(messagePayload as any);

    if (insertError) {
        console.error(`[Message Handler] Failed to insert inbound message for contact ${contact.id}:`, insertError);
        throw insertError;
    }

    console.log(`[Message Handler] Message from ${contact.name} saved. Firing automation and sentiment analysis events.`);

    if (message.type === 'text') {
        await analyzeAndStoreSentiment(messageBody, contact.id); 
    }

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