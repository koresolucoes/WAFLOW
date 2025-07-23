
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { Tables, TablesInsert, TablesUpdate } from './_lib/types.js';
import { publishEvent } from './_lib/automation/trigger-handler.js';
import { findOrCreateContactByPhone } from './_lib/webhook/contact-mapper.js';


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
        console.log("Webhook payload recebido:", JSON.stringify(req.body, null, 2));

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
                    
                    // ---- ATUALIZAÇÕES DE STATUS ----
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
                        for (const message of value.messages) {
                             const promise = (async () => {
                                try {
                                    const wabaId = value.metadata.phone_number_id;
                                    console.log(`[LOG] Procurando perfil com meta_phone_number_id: ${wabaId}`);

                                    const { data: profileData, error: profileError } = await supabaseAdmin.from('profiles').select('id').eq('meta_phone_number_id', wabaId).single();
                                    
                                    if (profileError || !profileData) {
                                        throw new Error(`[ERRO CRÍTICO] Perfil não encontrado para o wabaId ${wabaId}. Verifique a página de Configurações. Erro: ${JSON.stringify(profileError, null, 2)}`);
                                    }
                                    const userId = (profileData as unknown as Tables<'profiles'>).id;
                                    console.log(`[LOG] Perfil encontrado com sucesso! user_id: ${userId}`);

                                    const { contact, isNew } = await findOrCreateContactByPhone(userId, message.from, value.contacts[0].profile.name);
                                    if (!contact) {
                                        throw new Error(`[ERRO] Não foi possível encontrar ou criar o contato para o telefone ${message.from}.`);
                                    }
                                    console.log(`[LOG] Contato processado: ID ${contact.id}, É Novo: ${isNew}`);

                                    let messageBody = `[${message.type}]`;
                                    if (message.type === 'text') {
                                        messageBody = message.text.body;
                                    } else if (message.type === 'interactive' && message.interactive?.button_reply) {
                                        messageBody = `Botão Clicado: "${message.interactive.button_reply.title}"`;
                                    }
                                    
                                    const receivedMessagePayload: TablesInsert<'received_messages'> = {
                                        user_id: userId,
                                        contact_id: contact.id,
                                        meta_message_id: message.id,
                                        message_body: messageBody
                                    };
                                    
                                    const { error: insertError } = await supabaseAdmin.from('received_messages').insert(receivedMessagePayload);
                                    if (insertError) {
                                        throw new Error(`[ERRO] ERRO ao inserir mensagem recebida: ${JSON.stringify(insertError, null, 2)}`);
                                    }
                                    console.log("[LOG] Mensagem inserida com sucesso em 'received_messages'.");
                                    
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
                                     console.error(`[ERRO] Falha ao processar a mensagem ${message.id}:`, e.message);
                                }
                            })();
                            processingPromises.push(promise);
                        }
                    }
                }
            }
            await Promise.all(processingPromises);
            console.log("[LOG] Processamento completo do evento do webhook.");

        } catch(error: any) {
            console.error("[ERRO GERAL] Erro não tratado no processamento do webhook:", error.message, error.stack);
        }
        
        return;
    }

    return res.status(405).send('Method Not Allowed');
}