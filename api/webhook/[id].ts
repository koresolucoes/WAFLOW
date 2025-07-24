
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { TablesUpdate } from '../_lib/types.js';
import { publishEvent } from '../_lib/automation/trigger-handler.js';
import { findOrCreateContactByPhone } from '../_lib/webhook/contact-mapper.js';


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
            console.error("[ERRO] Requisição de Webhook recebida sem um ID de usuário na URL.");
            return res.status(400).send('Invalid User ID in webhook URL');
        }

        console.log(`[LOG] Webhook payload recebido para o usuário: ${userId}`);
        
        const { entry } = req.body;
        if (!entry || !Array.isArray(entry)) {
            console.error("Payload inválido: 'entry' não encontrado ou não é um array.");
            return res.status(400).send('Invalid payload');
        }
        
        // Responda imediatamente para evitar timeouts da Meta
        res.status(200).send('EVENT_RECEIVED');

        try {
            const processingPromises: Promise<void>[] = [];

            for (const item of entry) {
                for (const change of item.changes) {
                    const { field, value } = change;

                    if (field !== 'messages') {
                        continue;
                    }
                    
                    // ---- ATUALIZAÇÕES DE STATUS (não depende do perfil) ----
                    if (value.statuses) {
                        for (const status of value.statuses) {
                             const promise = (async () => {
                                try {
                                    const newStatus = status.status;
                                    const updateData: TablesUpdate<'campaign_messages'> = { status: newStatus };
                                    if (newStatus === 'delivered') updateData.delivered_at = new Date(status.timestamp * 1000).toISOString();
                                    if (newStatus === 'read') updateData.read_at = new Date(status.timestamp * 1000).toISOString();
                                    
                                    await supabaseAdmin.from('campaign_messages').update(updateData).eq('meta_message_id', status.id);
                                    
                                    const sentMessagesUpdate: TablesUpdate<'sent_messages'> = { status: newStatus };
                                    if (newStatus === 'delivered') sentMessagesUpdate.delivered_at = new Date(status.timestamp * 1000).toISOString();
                                    if (newStatus === 'read') sentMessagesUpdate.read_at = new Date(status.timestamp * 1000).toISOString();

                                    await supabaseAdmin.from('sent_messages').update(sentMessagesUpdate).eq('meta_message_id', status.id);
                                } catch(e: any) {
                                    console.error(`[ERRO] Falha ao processar atualização de status para a mensagem ${status.id}:`, e.message);
                                }
                            })();
                            processingPromises.push(promise);
                        }
                    }

                    // ---- MENSAGENS RECEBIDAS ----
                    if (value.messages) {
                        const phoneNumberId = value?.metadata?.phone_number_id;
                        if (!phoneNumberId) {
                            console.warn(`[AVISO] Webhook para ${value.contacts?.[0]?.wa_id} ignorado por não conter 'phone_number_id' nos metadados.`);
                            continue;
                        }

                        // **NOVA LÓGICA**: VALIDA o ID do telefone, não busca por ele.
                        const { data: profileData, error: profileError } = await supabaseAdmin
                            .from('profiles')
                            .select('*')
                            .eq('id', userId)
                            .single();

                        if (profileError || !profileData) {
                            console.error(`[ERRO] Perfil não encontrado ou erro de DB para o user_id: ${userId}. A URL do webhook pode estar incorreta.`);
                            continue; // Pula este lote de mensagens
                        }

                        if (profileData.meta_phone_number_id !== String(phoneNumberId)) {
                             console.warn(`
                                [AVISO DE INCOMPATIBILIDADE] Mensagem processada, mas com aviso.
                                O 'ID do número de telefone' recebido da Meta ('${phoneNumberId}') 
                                não corresponde ao configurado para o usuário ${userId} ('${profileData.meta_phone_number_id}').
                                Verifique suas configurações na Meta e no ZapFlow AI para garantir o funcionamento correto. A mensagem ainda será processada.
                            `);
                        }

                        // O userId foi validado. Agora processa as mensagens.
                        for (const message of value.messages) {
                            const promise = (async () => {
                                try {
                                    const contactName = value.contacts?.[0]?.profile?.name || 'Contato via WhatsApp';
                                    const { contact, isNew } = await findOrCreateContactByPhone(userId, message.from, contactName);
                                    
                                    if (!contact) {
                                        console.error(`[ERRO] Não foi possível encontrar ou criar o contato para o telefone ${message.from}.`);
                                        return;
                                    }
                                    
                                    let messageBody = `[${message.type}]`;
                                    if (message.type === 'text' && message.text?.body) {
                                        messageBody = message.text.body;
                                    } else if (message.type === 'interactive' && message.interactive?.button_reply) {
                                        messageBody = `Botão Clicado: "${message.interactive.button_reply.title}"`;
                                    }
                                    
                                    const { data: insertedMessage, error: insertError } = await supabaseAdmin.from('received_messages').insert({
                                        user_id: userId,
                                        contact_id: contact.id,
                                        meta_message_id: message.id,
                                        message_body: messageBody
                                    }).select().single();

                                    if (insertError || !insertedMessage) {
                                        console.error(`Error inserting received message for contact ${contact.id}:`, insertError);
                                        return;
                                    }
                                    
                                    // Broadcast the new message to the client
                                    const channel = supabaseAdmin.channel(`inbox-changes-for-user-${userId}`);
                                    await channel.send({
                                        type: 'broadcast',
                                        event: 'new_message',
                                        payload: {
                                            eventType: 'INSERT',
                                            table: 'received_messages',
                                            new: insertedMessage
                                        }
                                    });
                                    await supabaseAdmin.removeChannel(channel);
                                    
                                    await publishEvent('message_received', userId, { contact, message });
                                    if (isNew) {
                                        await publishEvent('contact_created', userId, { contact });
                                        if (contact.tags && contact.tags.length > 0) {
                                            await Promise.all(
                                                contact.tags.map(tag => publishEvent('tag_added', userId, { contact, tag }))
                                            );
                                        }
                                    }
                                } catch(e: any) {
                                     console.error(`[ERRO GERAL NO PROCESSAMENTO DA MENSAGEM] ID da mensagem ${message.id}:`, e.message, e.stack);
                                }
                            })();
                            processingPromises.push(promise);
                        }
                    }
                }
            }
            await Promise.all(processingPromises);
            console.log(`[LOG] Processamento do webhook para o usuário ${userId} concluído.`);

        } catch(error: any) {
            console.error("[ERRO GERAL] Erro não tratado no processamento do webhook:", error.message, error.stack);
        }
        
        return;
    }

    return res.status(405).send('Method Not Allowed');
}
