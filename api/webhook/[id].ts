
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getProfileForWebhook } from '../_lib/webhook/profile-handler';
import { processStatusUpdate } from '../_lib/webhook/status-handler';
import { processIncomingMessage } from '../_lib/webhook/message-handler';

/**
 * Manipulador de webhook principal para todos os eventos da Meta.
 * Atua como um despachante para manipuladores modularizados.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Lidar com a Solicitação de Verificação da Meta
    if (req.method === 'GET') {
        const verifyToken = process.env.META_VERIFY_TOKEN;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('Webhook verificado com sucesso!');
            return res.status(200).send(challenge);
        } else {
            console.error('Falha na verificação do webhook. Certifique-se de que META_VERIFY_TOKEN está configurado.');
            return res.status(403).send('Forbidden');
        }
    }

    // 2. Lidar com Notificações de Eventos da Meta
    if (req.method === 'POST') {
        const { id: userId } = req.query;
        if (typeof userId !== 'string' || !userId) {
            console.error("[Webhook] Requisição recebida sem um ID de usuário na URL.");
            return res.status(400).send('ID de usuário inválido na URL do webhook');
        }

        // Responde imediatamente à Meta para evitar timeouts
        res.status(200).send('EVENT_RECEIVED');
        
        console.log(`[Webhook] Payload recebido para o usuário: ${userId}`);
        
        const profile = await getProfileForWebhook(userId);
        if (!profile) {
            console.error(`[Webhook] Não foi possível recuperar ou criar um perfil para o usuário ${userId}. Abortando.`);
            return;
        }

        const { entry } = req.body;
        if (!entry || !Array.isArray(entry)) {
            console.error("[Webhook] Payload inválido: 'entry' não encontrado ou não é um array.");
            return;
        }

        try {
            const promises: Promise<void>[] = [];
            for (const item of entry) {
                for (const change of item.changes) {
                    if (change.field !== 'messages') continue;
                    
                    const value = change.value;

                    // A) Lidar com Atualizações de Status
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            promises.push(processStatusUpdate(status));
                        }
                    }

                    // B) Lidar com Mensagens Recebidas
                    if (value.messages) {
                        const incomingPhoneNumberId = value?.metadata?.phone_number_id;
                        if (profile.meta_phone_number_id !== String(incomingPhoneNumberId)) {
                            console.warn(`[Webhook] O phone_number_id (${incomingPhoneNumberId}) recebido não corresponde ao configurado para o usuário ${userId}. Processando mesmo assim.`);
                        }
                        
                        for (const message of value.messages) {
                            promises.push(processIncomingMessage(userId, message, value.contacts));
                        }
                    }
                }
            }

            // Processa todas as notificações concorrentemente
            await Promise.all(promises);
            console.log(`[Webhook] Lote de processamento para o usuário ${userId} concluído.`);

        } catch (error: any) {
            console.error("[Webhook] Erro não tratado durante o loop de processamento:", error.message, error.stack);
        }
        
        return;
    }

    // 3. Lidar com outros métodos
    return res.status(405).send('Method Not Allowed');
}
