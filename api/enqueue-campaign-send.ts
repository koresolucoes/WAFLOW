
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'https://esm.sh/@upstash/qstash@^2.8.1';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { TablesInsert } from './_lib/database.types.js';
import { getMetaTemplateById } from './_lib/meta/templates.js';
import { getMetaConfig } from './_lib/automation/helpers.js';
import { MessageTemplate } from './_lib/types.js';


// Verifique se as variáveis de ambiente estão definidas.
if (!process.env.QSTASH_TOKEN) {
    throw new Error("A variável de ambiente QSTASH_TOKEN é obrigatória.");
}
if (!process.env.APP_URL) {
    throw new Error("A variável de ambiente APP_URL é obrigatória.");
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
        // 1. Autenticar o usuário
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'O cabeçalho de autorização está ausente ou malformado.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        // 2. Validar o corpo da requisição
        const { teamId, templateId, variables, recipients, speed, campaignName, scheduleDate } = req.body;
        if (!teamId || !templateId || !recipients || !Array.isArray(recipients) || !speed || !campaignName) {
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

        // 4. Buscar detalhes do template e do perfil UMA VEZ
        const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
        if (profileError || !profile) throw new Error(`Perfil não encontrado para o usuário ${user.id}`);

        const { data: templateData, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
        const template = templateData as unknown as MessageTemplate;
        if (templateError || !template) throw new Error(`Template com ID ${templateId} não encontrado.`);
        if (!template.meta_id) throw new Error(`Template '${template.template_name}' não está sincronizado com a Meta.`);
        
        const metaConfig = getMetaConfig(profile);
        const metaTemplateDetails = await getMetaTemplateById(metaConfig, template.meta_id);

        // 5. Salvar campanha e mensagens no DB
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
        