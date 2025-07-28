import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { redis } from './_lib/redis.js';
import { getMetaConfig, resolveVariables } from './_lib/automation/helpers.js';
import { sendTemplatedMessage } from './_lib/meta/messages.js';
import { getMetaTemplateById } from './_lib/meta/templates.js';
import { Contact, MessageInsert, MessageTemplate, Profile } from './_lib/types.js';
import { Tables } from './_lib/database.types.js';

type CampaignJob = {
    contact_id: string;
    team_id: string;
    campaign_id: string;
    template_variables: Record<string, string>;
};

type Campaign = Tables<'campaigns'>;

const processJob = async (job: CampaignJob, campaign: Campaign, profile: Profile, template: MessageTemplate) => {
    const { contact_id, team_id, campaign_id, template_variables } = job;

    try {
        const { data: contact, error: contactError } = await supabaseAdmin.from('contacts').select('*').eq('id', contact_id).single();
        if (contactError || !contact) throw new Error(`Contact ${contact_id} not found.`);

        const metaConfig = getMetaConfig(profile);
        
        if (!template.meta_id) throw new Error(`Template ${template.template_name} is not synced with Meta.`);
        
        const metaTemplateDetails = await getMetaTemplateById(metaConfig, template.meta_id);

        const finalComponents: any[] = [];
        const context = { contact, trigger: null };

        const resolvePlaceholder = (placeholder: string) => {
            const rawValue = placeholder === '{{1}}' ? '{{contact.name}}' : (template_variables[placeholder] || '');
            return resolveVariables(rawValue, context);
        };
        
        // ... (Lógica de construção de componentes copiada de sendTemplate handler)
        const headerComponent = template.components.find(c => c.type === 'HEADER');
        if (headerComponent?.text) {
            const placeholders = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
            if (placeholders.length > 0) finalComponents.push({ type: 'header', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
        }
        const bodyComponent = template.components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const placeholders = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
            if (placeholders.length > 0) finalComponents.push({ type: 'body', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
        }
        const buttonsComponent = template.components.find(c => c.type === 'BUTTONS');
        if (buttonsComponent?.buttons) {
            buttonsComponent.buttons.forEach((button, index) => {
                if (button.type === 'URL' && button.url) {
                    const placeholders = button.url.match(/\{\{\d+\}\}/g) || [];
                    if (placeholders.length > 0) finalComponents.push({ type: 'button', sub_type: 'url', index: String(index), parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
                }
            });
        }
        // ... (Fim da lógica de construção)

        const response = await sendTemplatedMessage(metaConfig, contact.phone, metaTemplateDetails.name, metaTemplateDetails.language, finalComponents.length > 0 ? finalComponents : undefined);
        
        let resolvedContent = bodyComponent?.text || '';
        const placeholdersInBody = resolvedContent.match(/\{\{\d+\}\}/g) || [];
        for (const placeholder of placeholdersInBody) {
            resolvedContent = resolvedContent.replace(placeholder, resolvePlaceholder(placeholder));
        }

        const messageLog: MessageInsert = { team_id, contact_id, campaign_id, content: resolvedContent, meta_message_id: response.messages[0].id, status: 'sent', source: 'campaign', type: 'outbound', sent_at: new Date().toISOString() };
        return { success: true, log: messageLog };

    } catch (err: any) {
        console.error(`[WORKER] Failed to process job for contact ${contact_id} in campaign ${campaign_id}:`, err.message);
        const messageLog: MessageInsert = { team_id, contact_id, campaign_id, content: template.components.find(c => c.type === 'BODY')?.text || '', status: 'failed', source: 'campaign', type: 'outbound', error_message: err.message };
        return { success: false, log: messageLog };
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Adicione uma verificação de segurança se desejar, ex: `req.headers['x-vercel-cron-secret']`
    
    console.log('[WORKER] Cron job started.');
    const now = new Date().toISOString();

    // 1. Ativar campanhas agendadas
    const { data: scheduledCampaigns, error: scheduledError } = await supabaseAdmin
        .from('campaigns')
        .update({ status: 'Sending' } as any)
        .eq('status', 'Scheduled')
        .lte('sent_at', now)
        .select('id');

    if (scheduledError) console.error('[WORKER] Error activating scheduled campaigns:', scheduledError);
    if (scheduledCampaigns && scheduledCampaigns.length > 0) console.log(`[WORKER] Activated ${scheduledCampaigns.length} scheduled campaigns.`);

    // 2. Processar campanhas 'Sending'
    const { data: sendingCampaigns, error: sendingError } = await supabaseAdmin
        .from('campaigns')
        .select('*, teams(profiles(*)), message_templates(*)')
        .eq('status', 'Sending');

    if (sendingError) {
        console.error('[WORKER] Error fetching sending campaigns:', sendingError);
        return res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
    
    if (!sendingCampaigns || sendingCampaigns.length === 0) {
        console.log('[WORKER] No campaigns to process.');
        return res.status(200).json({ message: 'No campaigns to process.' });
    }

    console.log(`[WORKER] Found ${sendingCampaigns.length} campaigns to process.`);

    for (const campaign of (sendingCampaigns as any[])) {
        const queueKey = `campaign:${campaign.id}`;
        const throttleRate = campaign.throttle_rate || 60;
        
        try {
            const rawJobs = await redis.rpop(queueKey, throttleRate);
            if (!rawJobs || rawJobs.length === 0) {
                // Fila vazia, verificar se a campanha terminou
                const queueLength = await redis.llen(queueKey);
                if (queueLength === 0) {
                    console.log(`[WORKER] Campaign ${campaign.id} queue is empty. Marking as Sent.`);
                    await supabaseAdmin.from('campaigns').update({ status: 'Sent' } as any).eq('id', campaign.id);
                }
                continue;
            }

            const jobsStrings = Array.isArray(rawJobs) ? rawJobs : [rawJobs];

            const jobs: CampaignJob[] = jobsStrings.map(j => JSON.parse(j as string));
            console.log(`[WORKER] Processing ${jobs.length} jobs for campaign ${campaign.id}`);

            const profile = campaign.teams.profiles as Profile;
            const template = campaign.message_templates as unknown as MessageTemplate;
            if (!profile || !template) {
                 throw new Error(`Profile or Template not found for campaign ${campaign.id}`);
            }

            const results = await Promise.allSettled(jobs.map(job => processJob(job, campaign, profile, template)));
            const logsToInsert = results.map(r => r.status === 'fulfilled' ? r.value.log : null).filter(Boolean);

            if (logsToInsert.length > 0) {
                const { error: insertError } = await supabaseAdmin.from('messages').insert(logsToInsert as any);
                if (insertError) console.error(`[WORKER] Failed to batch insert message logs for campaign ${campaign.id}:`, insertError);
            }

        } catch (e: any) {
            console.error(`[WORKER] Error processing campaign ${campaign.id}:`, e.message);
            // Marcar a campanha como falha para evitar novas tentativas
            await supabaseAdmin.from('campaigns').update({ status: 'Failed' } as any).eq('id', campaign.id);
        }
    }

    console.log('[WORKER] Cron job finished.');
    return res.status(200).json({ message: 'Campaign queue processed.' });
}
