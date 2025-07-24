
import { supabaseAdmin } from '../supabaseAdmin.js';
import { findOrCreateContactByPhone } from './contact-mapper.js';
import { publishEvent } from '../automation/trigger-handler.js';
import { Profile } from '../types.js';

export async function processIncomingMessage(
    userId: string, 
    profile: Profile, 
    message: any, 
    contactsPayload: any
): Promise<void> {
    try {
        const contactName = contactsPayload?.[0]?.profile?.name || 'Contato via WhatsApp';
        const { contact, isNew } = await findOrCreateContactByPhone(userId, message.from, contactName);

        if (!contact) {
            console.error(`[Manipulador de Mensagem] Não foi possível encontrar ou criar contato para o telefone ${message.from}.`);
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
            console.error(`[Manipulador de Mensagem] Falha ao inserir mensagem recebida para o contato ${contact.id}:`, insertError);
            return;
        }

        console.log(`[MessageHandler] Mensagem de ${contact.name} salva. Disparando eventos de automação.`);

        // Publica eventos para automações e outros efeitos colaterais
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
        console.error(`[Manipulador de Mensagem] Falha geral no processamento da mensagem para o ID da mensagem ${message.id}:`, e.message, e.stack);
    }
}
