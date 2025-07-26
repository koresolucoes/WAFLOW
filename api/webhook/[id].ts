
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getProfileForWebhook } from '../_lib/webhook/profile-handler.js';
import { processStatusUpdate } from '../_lib/webhook/status-handler.js';
import { processIncomingMessage } from '../_lib/webhook/message-handler.js';
import { TablesInsert, Json } from '../_lib/types.js';
import { getRawBody } from '../_lib/webhook/parser.js';

// desativa parse Json
export const config = {
  api: {
    bodyParser: false,
  },
};

const handlePostRequest = async (req: VercelRequest) => {
    try {
        const { id: userId } = req.query;
        if (typeof userId !== 'string' || !userId) {
            console.error("[Webhook] Requisição recebida sem um ID de usuário na URL.");
            return;
        }
        
        const rawBodyBuffer = await getRawBody(req);
        if (rawBodyBuffer.length === 0) {
            console.warn('[Webhook] Request body is empty.');
            return; // No body to process
        }

        let body: any;
        try {
            body = JSON.parse(rawBodyBuffer.toString('utf-8'));
        } catch (parseError: any) {
            console.error('[Webhook] Failed to parse request body as JSON:', parseError.message);
            console.error('[Webhook] Raw body content:', rawBodyBuffer.toString('utf-8').substring(0, 500));
            return;
        }


        try {
            const logPayload: TablesInsert<'webhook_logs'> = {
                user_id: userId,
                source: 'meta_message',
                payload: body as unknown as Json,
                path: req.url
            };
            await supabaseAdmin.from('webhook_logs').insert(logPayload);
        } catch (logError) {
            console.error('[Webhook] Failed to log incoming webhook:', logError);
        }

        console.log(`[Webhook] Payload recebido para o usuário: ${userId}`);
        
        const profile = await getProfileForWebhook(userId);
        if (!profile) {
            console.error(`[Webhook] Não foi possível recuperar o perfil para o usuário ${userId}. Abortando.`);
            return;
        }

        const { entry } = body;
        if (!entry || !Array.isArray(entry)) {
            console.error("[Webhook] Payload inválido: 'entry' não encontrado ou não é um array.");
            return;
        }

        const processingPromises: Promise<any>[] = [];

        for (const item of entry) {
            for (const change of item.changes) {
                if (change.field !== 'messages' || !change.value) continue;
                
                const { value } = change;

                if (value.statuses && Array.isArray(value.statuses)) {
                    for (const status of value.statuses) {
                        processingPromises.push(processStatusUpdate(status, userId));
                    }
                }

                if (value.messages && Array.isArray(value.messages)) {
                    for (const message of value.messages) {
                        processingPromises.push(processIncomingMessage(userId, message, value.contacts));
                    }
                }
            }
        }
        
        if (processingPromises.length > 0) {
             console.log(`[Webhook] Aguardando a conclusão de ${processingPromises.length} promessas de processamento.`);
             const results = await Promise.allSettled(processingPromises);
             results.forEach((result, index) => {
                 if (result.status === 'rejected') {
                     console.error(`[Webhook] A promessa de processamento na posição ${index} falhou:`, result.reason);
                 }
             });
             console.log(`[Webhook] Lote de processamento para o usuário ${userId} concluído.`);
        } else {
            console.log('[Webhook] Nenhum evento de mensagem ou status válido para processar no payload.');
        }

    } catch (error: any) {
        console.error("[Webhook] Erro não tratado durante o processamento assíncrono:", error.message, error.stack);
    }
}


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
        // Responde imediatamente à Meta para evitar timeouts e processa em segundo plano.
        res.status(200).send('EVENT_RECEIVED');
        handlePostRequest(req);
        return;
    }

    // 3. Lidar com outros métodos
    return res.status(405).send('Method Not Allowed');
}
