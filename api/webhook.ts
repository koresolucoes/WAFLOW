
// /api/webhook.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database.types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

if (!supabaseUrl || !supabaseServiceKey || !VERIFY_TOKEN) {
    throw new Error("Variáveis de ambiente do servidor não configuradas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_VERIFY_TOKEN são necessárias.");
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false
    }
});

// Helpers
const findProfileByPhoneNumberId = async (phoneId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('meta_phone_number_id', phoneId)
        .single();
    if (error) {
        console.error(`Webhook: Erro ao buscar perfil pelo phone_number_id ${phoneId}:`, error.message);
        return null;
    }
    return data;
};

const processStatuses = async (statuses: any[]) => {
    for (const status of statuses) {
        const updateData: { status: any; delivered_at?: string; read_at?: string } = { status: status.status };
        
        // Meta sends timestamps as strings representing seconds since epoch.
        const timestamp = parseInt(status.timestamp, 10) * 1000;
        if (isNaN(timestamp)) continue;

        if (status.status === 'delivered') {
            updateData.delivered_at = new Date(timestamp).toISOString();
        }
        if (status.status === 'read') {
            updateData.read_at = new Date(timestamp).toISOString();
        }
        
        const { error } = await supabase
            .from('campaign_messages')
            .update(updateData)
            .eq('meta_message_id', status.id);

        if (error) {
            console.error(`Webhook: Erro ao atualizar status da mensagem ${status.id} para ${status.status}:`, error.message);
        } else {
            console.log(`Webhook: Status da mensagem ${status.id} atualizado para ${status.status}.`);
        }
    }
};

const processIncomingMessages = async (messages: any[], userId: string) => {
    for (const message of messages) {
        // Por enquanto, processar apenas mensagens de texto para simplicidade.
        if (message.type !== 'text') {
            console.log(`Webhook: Ignorando mensagem não-texto do tipo ${message.type}.`);
            continue;
        }

        const contactPhone = message.from;

        // Buscar contato correspondente. Assume-se que o número de telefone está armazenado sem formatação.
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', userId)
            .eq('phone', contactPhone)
            .single();

        if (contactError || !contact) {
            console.warn(`Webhook: Mensagem recebida de um contato desconhecido (${contactPhone}) para o usuário ${userId}.`, contactError?.message);
            continue;
        }

        const timestamp = parseInt(message.timestamp, 10) * 1000;
        if (isNaN(timestamp)) continue;

        const { error: insertError } = await supabase
            .from('received_messages')
            .insert({
                user_id: userId,
                contact_id: contact.id,
                meta_message_id: message.id,
                message_body: message.text?.body || '',
                received_at: new Date(timestamp).toISOString()
            });

        if (insertError) {
            console.error(`Webhook: Erro ao inserir mensagem recebida ${message.id}:`, insertError.message);
        } else {
            console.log(`Webhook: Nova mensagem ${message.id} de ${contactPhone} armazenada.`);
        }
    }
};

// Main handler
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
        console.error('Falha na verificação do Webhook. Tokens não correspondem.');
        return new Response('Failed validation', { status: 403 });
    }
};

const handlePost = async (req: Request): Promise<Response> => {
    try {
        const body = await req.json();
        // console.log('Webhook: Corpo recebido:', JSON.stringify(body, null, 2));

        if (body.object !== 'whatsapp_business_account') {
            return new Response('Not a WhatsApp Business Account notification', { status: 200 });
        }
        
        for (const entry of body.entry) {
            for (const change of entry.changes) {
                if (change.field === 'messages') {
                    const value = change.value;
                    const metadata = value.metadata;
                    
                    const profile = await findProfileByPhoneNumberId(metadata.phone_number_id);

                    if (!profile) {
                        console.error(`Webhook: Nenhum perfil encontrado para phone_number_id ${metadata.phone_number_id}. Ignorando.`);
                        continue;
                    }

                    if (value.statuses) {
                        await processStatuses(value.statuses);
                    }
                    if (value.messages) {
                        await processIncomingMessages(value.messages, profile.id);
                    }
                }
            }
        }

        return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (error: any) {
        console.error('Webhook: Erro ao processar a requisição POST:', error);
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
