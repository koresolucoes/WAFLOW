import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@upstash/qstash';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { TablesInsert } from './_lib/database.types.js';

// Verifique se as variáveis de ambiente do QStash estão definidas.
if (!process.env.QSTASH_TOKEN) {
    throw new Error("A variável de ambiente QSTASH_TOKEN é obrigatória.");
}

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Apenas requisições POST são permitidas' });
    }

    try {
        // 1. Autenticar o usuário a partir do token de acesso
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'O cabeçalho de autorização está ausente ou malformado.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        // 2. Obter e validar o corpo da requisição
        const { teamId, templateId, variables, recipients, speed, campaignName, scheduleDate } = req.body;
        if (!teamId || !templateId || !recipients || !speed || !campaignName) {
            return res.status(400).json({ error: 'Faltando campos obrigatórios no corpo da requisição.' });
        }

        // 3. Verificar se o usuário é membro da equipe
        const { count, error: memberError } = await supabaseAdmin
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('team_id', teamId);
        if (memberError || count === 0) {
            return res.status(403).json({ error: 'Acesso negado a esta equipe.' });
        }
        
        // 4. Salvar o registro da campanha e das mensagens pendentes no DB
        const campaignPayload: TablesInsert<'campaigns'> = {
            name: campaignName,
            team_id: teamId,
            template_id: templateId,
            status: 'Scheduled',
            sent_at: scheduleDate ? new Date(scheduleDate).toISOString() : new Date().toISOString(),
            recipient_count: recipients.length,
        };
        
        const { data: newCampaignData, error: campaignError } = await supabaseAdmin.from('campaigns').insert(campaignPayload as any).select('id').single();
        if (campaignError) throw campaignError;
        const campaignId = (newCampaignData as any).id;

        const messagesToInsert = recipients.map((r: any) => ({
            campaign_id: campaignId,
            team_id: teamId,
            contact_id: r.id,
            status: 'pending',
            type: 'outbound',
            source: 'campaign',
            content: 'Enfileirado via QStash...',
        }));

        const { error: messagesError } = await supabaseAdmin.from('messages').insert(messagesToInsert as any);
        if (messagesError) {
            // Reverte a criação da campanha se a inserção das mensagens falhar
            await supabaseAdmin.from('campaigns').delete().eq('id', campaignId);
            throw messagesError;
        }
        
        // 5. Determinar o atraso e construir as mensagens para o QStash
        const delayMap = { instant: 0, slow: 60, 'very_slow': 300 };
        const staggerDelay = delayMap[speed as keyof typeof delayMap] || 0;
        
        const vercelUrl = process.env.VERCEL_URL;
        if (!vercelUrl) {
          return res.status(500).json({ message: 'A variável de ambiente VERCEL_URL não está configurada.' });
        }
    
        const scheduleTimestamp = scheduleDate ? Math.floor(new Date(scheduleDate).getTime() / 1000) : undefined;

        const qstashMessages = recipients.map((recipient: any, index: number) => {
            const messagePayload: any = {
                destination: `https://${vercelUrl}/api/send-single-message`,
                body: JSON.stringify({
                    teamId,
                    campaignId,
                    templateId,
                    variables,
                    recipient,
                    userId: user.id
                }),
                headers: { "Content-Type": "application/json" },
            };
            
            if (scheduleTimestamp) {
                // Se agendado, usa notBefore para cada mensagem, com o atraso de escalonamento
                messagePayload.notBefore = scheduleTimestamp + (index * staggerDelay);
            } else if (staggerDelay > 0) {
                // Se não agendado mas escalonado, usa delay
                messagePayload.delay = index * staggerDelay;
            }

            return messagePayload;
        }));


        // 6. Publicar as mensagens em lote para o QStash
        if (qstashMessages.length > 0) {
            await qstashClient.batch(qstashMessages);
        }
        
        return res.status(202).json({ message: 'Campanha aceita e enfileirada para envio.' });

    } catch (error: any) {
        console.error("Erro na função enqueue-campaign-send:", error);
        return res.status(500).json({ message: "Falha ao enfileirar a campanha.", error: error.message });
    }
}