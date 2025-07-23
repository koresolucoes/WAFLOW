
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
                        // **LÓGICA REATORADA**: Busca o perfil UMA VEZ para este lote inteiro de mensagens.
                        const phoneNumberId = value?.metadata?.phone_number_id;

                        if (!phoneNumberId) {
                            console.warn(`[AVISO] Webhook para ${value.contacts?.[0]?.wa_id} ignorado por não conter 'phone_number_id' nos metadados.`);
                            continue; // Pula este objeto 'change' inteiro.
                        }

                        const phoneNumberIdStr = String(phoneNumberId).trim();
                        
                        console.log(`[LOG] Lógica de verificação de perfil iniciada para o ID: ${phoneNumberIdStr}`);
                        
                        const findProfile = async (attempt: number): Promise<Tables<'profiles'> | null> => {
                            console.log(`[LOG] Procurando perfil com meta_phone_number_id: ${phoneNumberIdStr} (Tentativa ${attempt})`);
                            const { data, error } = await supabaseAdmin
                                .from('profiles')
                                .select('id, meta_phone_number_id')
                                .eq('meta_phone_number_id', phoneNumberIdStr)
                                .limit(1);

                            if (error) {
                                console.error(`[ERRO DB] Falha na busca do perfil (Tentativa ${attempt}):`, error.message);
                                return null;
                            }

                            if (data && data.length > 0) {
                                console.log(`[LOG] Perfil encontrado com sucesso! user_id: ${data[0].id}`);
                                return data[0] as Tables<'profiles'>;
                            }
                            return null;
                        };

                        let profile = await findProfile(1);

                        if (!profile) {
                            console.log('[DEBUG] Primeira tentativa falhou, aguardando 1 segundo para tentar novamente...');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            profile = await findProfile(2);
                        }
                        
                        if (!profile) {
                            const { data: allProfilesWithIds } = await supabaseAdmin.from('profiles').select('id, meta_phone_number_id').not('meta_phone_number_id', 'is', null);
                            const profilesWithIds = allProfilesWithIds || [];
                            
                            console.warn(`
===============================================================
[AVISO DE CONFIGURAÇÃO] NENHUM PERFIL CORRESPONDENTE ENCONTRADO
---------------------------------------------------------------
ID do Número de Telefone recebido da Meta: '${phoneNumberIdStr}'
IDs verificados no banco de dados:
${profilesWithIds.map(p => `- '${p.meta_phone_number_id}'`).join('\n') || 'Nenhum'}

Como Corrigir:
1. Copie o ID da Meta ('${phoneNumberIdStr}').
2. Vá para a página de 'Configurações'.
3. Cole o valor no campo "ID do número de telefone".
4. Salve as alterações.
===============================================================
                            `);
                            continue; // Pula este lote de mensagens.
                        }
                        
                        // Agora que temos um perfil válido, processa as mensagens em paralelo.
                        for (const message of value.messages) {
                            const promise = (async () => {
                                try {
                                    const userId = profile.id;
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
                                    
                                    await supabaseAdmin.from('received_messages').insert({
                                        user_id: userId,
                                        contact_id: contact.id,
                                        meta_message_id: message.id,
                                        message_body: messageBody
                                    });
                                    
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
            console.log("[LOG] Processamento completo do evento do webhook.");

        } catch(error: any) {
            console.error("[ERRO GERAL] Erro não tratado no processamento do webhook:", error.message, error.stack);
        }
        
        return;
    }

    return res.status(405).send('Method Not Allowed');
}
