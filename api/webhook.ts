// /api/webhook.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database.types';

// As credenciais DEVEM ser configuradas como variáveis de ambiente no seu provedor de hospedagem (ex: Vercel).
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

// Verifica se as variáveis de ambiente essenciais estão definidas
if (!supabaseUrl || !supabaseServiceKey || !VERIFY_TOKEN) {
    throw new Error("Variáveis de ambiente essenciais (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_VERIFY_TOKEN) não estão definidas.");
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const handleVerification = (req: Request): Response => {
    const url = new URL(req.url);
    const params = url.searchParams;
    const mode = params.get('hub.mode');
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } else {
        console.error('Falha na validação do Webhook. Verifique se os tokens correspondem.');
        return new Response('Failed validation', { status: 403 });
    }
};

const handlePost = async (req: Request): Promise<Response> => {
    try {
        const body = await req.json();
        console.log('Webhook body recebido:', JSON.stringify(body, null, 2));

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages') {
                        const value = change.value;
                        
                        // Processar atualizações de status
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                const { error } = await supabase
                                    .from('campaign_messages')
                                    .update({ 
                                        status: status.status,
                                        delivered_at: status.status === 'delivered' ? new Date(status.timestamp * 1000).toISOString() : undefined,
                                        read_at: status.status === 'read' ? new Date(status.timestamp * 1000).toISOString() : undefined,
                                     })
                                    .eq('meta_message_id', status.id);
                                if(error) {
                                    console.error(`Erro ao atualizar status da mensagem ${status.id}:`, error);
                                } else {
                                    console.log(`Status da mensagem ${status.id} atualizado para ${status.status}.`);
                                }
                            }
                        }
                        
                        // Processar mensagens recebidas
                        if (value.messages) {
                             // TODO: Implementar lógica para salvar mensagens recebidas na tabela `received_messages`.
                            console.log('Mensagem recebida:', value.messages[0]);
                        }
                    }
                }
            }
        }

        return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (error: any) {
        console.error('Erro ao processar o webhook:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
};

export default async function handler(req: Request) {
    if (req.method === 'GET') {
        return handleVerification(req);
    } else if (req.method === 'POST') {
        return handlePost(req);
    } else {
        return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'GET, POST' } });
    }
}
