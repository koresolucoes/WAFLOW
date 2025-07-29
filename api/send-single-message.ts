import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { getMetaTemplateById } from './_lib/meta/templates.js';
import { sendTemplatedMessage } from './_lib/meta/messages.js';
import { getMetaConfig, resolveVariables } from './_lib/automation/helpers.js';
import { MessageTemplate, MessageInsert, Profile } from './_lib/types.js';

// In a real production environment, you should verify the signature from QStash
// to ensure that the request is legitimate. This requires the @upstash/qstash/verify
// package and setting QSTASH_CURRENT_SIGNING_KEY & QSTASH_NEXT_SIGNING_KEY env vars.
// Example:
// import { Receiver } from '@upstash/qstash/verify';
// const receiver = new Receiver({ ...keys... });
// const isValid = await receiver.verify({ signature, body });

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try {
        const { recipient, templateId, variables, campaignId, userId } = req.body;

        // 1. Fetch Profile (for Meta config) and Template
        const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        if (profileError || !profile) {
            throw new Error(`Profile not found for userId ${userId}.`);
        }
        
        const { data: template, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
        if (templateError || !template) {
            throw new Error(`Template not found for templateId ${templateId}.`);
        }

        const { data: teamData, error: teamError } = await supabaseAdmin.from('teams').select('id').eq('owner_id', userId).single();
        if (teamError || !teamData) {
            throw new Error(`Team not found for user ${userId}.`);
        }
        const teamId = teamData.id;

        const metaConfig = getMetaConfig(profile as unknown as Profile);
        const templateTyped = template as unknown as MessageTemplate;

        // 2. Send message via Meta API
        let metaResponse;
        try {
            if (!templateTyped.meta_id) {
                throw new Error(`Template '${templateTyped.template_name}' is not synced with Meta.`);
            }
            const metaTemplateDetails = await getMetaTemplateById(metaConfig, templateTyped.meta_id!);
            const context = { contact: recipient, trigger: null }; // Trigger context is null for campaigns
            
            const resolvePlaceholder = (placeholder: string) => {
                const rawValue = placeholder === '{{1}}' ? '{{contact.name}}' : (variables[placeholder] || '');
                return resolveVariables(rawValue, context);
            };

            const finalComponents: any[] = [];
            // Header
            const headerComponent = templateTyped.components.find(c => c.type === 'HEADER');
            if (headerComponent?.text) {
                const placeholders = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
                if (placeholders.length > 0) {
                    finalComponents.push({ type: 'header', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
                }
            }
            // Body
            const bodyComponent = templateTyped.components.find(c => c.type === 'BODY');
            if (bodyComponent?.text) {
                const placeholders = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
                if (placeholders.length > 0) {
                    finalComponents.push({ type: 'body', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
                }
            }
            // Buttons
            const buttonsComponent = templateTyped.components.find(c => c.type === 'BUTTONS');
            if (buttonsComponent?.buttons) {
                buttonsComponent.buttons.forEach((button, index) => {
                    if (button.type === 'URL' && button.url) {
                         const placeholders = button.url.match(/\{\{\d+\}\}/g) || [];
                         if (placeholders.length > 0) {
                            finalComponents.push({ type: 'button', sub_type: 'url', index: String(index), parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }))});
                         }
                    }
                });
            }

            metaResponse = await sendTemplatedMessage(
                metaConfig,
                recipient.phone,
                metaTemplateDetails.name,
                metaTemplateDetails.language,
                finalComponents.length > 0 ? finalComponents : undefined
            );

            // Log success to DB
            let resolvedContent = bodyComponent?.text || '';
            const placeholdersInBody = resolvedContent.match(/\{\{\d+\}\}/g) || [];
            for (const placeholder of placeholdersInBody) {
                resolvedContent = resolvedContent.replace(placeholder, resolvePlaceholder(placeholder));
            }

            const messagePayload: MessageInsert = {
                team_id: teamId,
                contact_id: recipient.id,
                campaign_id: campaignId,
                meta_message_id: metaResponse.messages[0].id,
                status: 'sent',
                source: 'campaign',
                type: 'outbound',
                content: resolvedContent,
                sent_at: new Date().toISOString()
            };
            await supabaseAdmin.from('messages').insert(messagePayload as any);
            
            return res.status(200).json({ success: true, message: `Message sent to ${recipient.phone}` });

        } catch (sendError: any) {
            // Log failure to DB
            const messagePayload: MessageInsert = {
                team_id: teamId,
                contact_id: recipient.id,
                campaign_id: campaignId,
                status: 'failed',
                error_message: sendError.message,
                source: 'campaign',
                type: 'outbound',
                content: templateTyped.components.find(c => c.type === 'BODY')?.text || '',
            };
            await supabaseAdmin.from('messages').insert(messagePayload as any);
            throw sendError; // Throw to let QStash know it failed and potentially retry
        }
    } catch (error: any) {
        console.error("[WORKER] Error in send-single-message worker:", error);
        // Return 500 to signal failure to QStash for retry
        return res.status(500).json({ message: "Failed to send message.", error: error.message });
    }
}
