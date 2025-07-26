
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getProfileForWebhook } from '../_lib/webhook/profile-handler.js';
import { processStatusUpdate } from '../_lib/webhook/status-handler.js';
import { processIncomingMessage } from '../_lib/webhook/message-handler.js';
import { TablesInsert, Json } from '../_lib/types.js';
import { getRawBody } from '../_lib/webhook/parser.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id: pathIdentifier } = req.query;

    // 1. Lidar com a Solicitação de Verificação da Meta (GET)
    if (req.method === 'GET') {
        if (typeof pathIdentifier !== 'string' || !pathIdentifier) {
            console.error("[Webhook VERIFY] Requisição GET recebida sem um identificador na URL.");
            return res.status(400).send("Bad Request: Missing identifier.");
        }

        const profile = await getProfileForWebhook(pathIdentifier);
        if (!profile || !profile.meta_verify_token) {
            console.error(`[Webhook VERIFY] Perfil ou token de verificação não encontrado para o identificador ${pathIdentifier}.`);
            return res.status(403).send('Forbidden: Profile or verification token not found.');
        }

        const verifyTokenFromDb = profile.meta_verify_token;
        const mode = req.query['hub.mode'];
        const tokenFromMeta = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && tokenFromMeta === verifyTokenFromDb) {
            console.log(`Webhook verificado com sucesso para o usuário ${profile.id}!`);
            return res.status(200).send(challenge);
        } else {
            console.error(`Falha na verificação do webhook para o usuário ${profile.id}. Tokens não correspondem.`);
            return res.status(403).send('Forbidden: Token mismatch.');
        }
    }

    // 2. Lidar com Notificações de Eventos da Meta (POST)
    if (req.method === 'POST') {
        try {
            if (typeof pathIdentifier !== 'string' || !pathIdentifier) {
                console.error("[Webhook] Requisição recebida sem um identificador na URL.");
                return res.status(400).send("Bad Request: Missing identifier.");
            }

            const profile = await getProfileForWebhook(pathIdentifier);
            if (!profile) {
                console.error(`[Webhook] Nenhum perfil encontrado para o identificador ${pathIdentifier}. Abortando.`);
                return res.status(200).send('EVENT_RECEIVED_PROFILE_NOT_FOUND');
            }
            
            const userId = profile.id;
            console.log(`[Webhook] Perfil encontrado. Processando payload para o usuário: ${userId}`);

            const rawBodyBuffer = await getRawBody(req);
            if (rawBodyBuffer.length === 0) {
                console.warn('[Webhook] Request body is empty.');
                return res.status(200).send('EVENT_RECEIVED_EMPTY_BODY');
            }

            let body: any;
            try {
                body = JSON.parse(rawBodyBuffer.toString('utf-8'));
            } catch (parseError: any) {
                console.error('[Webhook] Falha ao analisar corpo da requisição como JSON:', parseError.message);
                return res.status(400).send('Bad Request: Invalid JSON.');
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
                console.error('[Webhook] Falha ao registrar webhook de entrada:', logError);
            }

            const { entry } = body;
            if (!entry || !Array.isArray(entry)) {
                console.warn("[Webhook] Payload recebido mas 'entry' não foi encontrado ou não é um array.");
                return res.status(200).send('EVENT_RECEIVED_NO_ENTRY');
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

            return res.status(200).send('EVENT_RECEIVED');

        } catch (error: any) {
            console.error("[Webhook] Erro não tratado no manipulador de POST:", error.message, error.stack);
            return res.status(500).send('Internal Server Error');
        }
    }

    // 3. Lidar com outros métodos
    return res.status(405).send('Method Not Allowed');
}
