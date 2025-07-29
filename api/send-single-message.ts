import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash/vercel';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendTemplatedMessage } from './_lib/meta/messages.js';
import { getMetaTemplateById } from './_lib/meta/templates.js';
import { getMetaConfig, resolveVariables } from './_lib/automation/helpers.js';
import { getRawBody } from './_lib/webhook/parser.js';
import { MessageTemplate } from './_lib/types.js';

// Configura a função para não usar o bodyParser padrão da Vercel
export const config = {
  api: {
    bodyParser: false,
  },
};

// Verifique se as chaves de assinatura estão definidas no início.
// Uma falha aqui causará um erro de inicialização da função, que é o comportamento desejado.
if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    throw new Error("As variáveis de ambiente QSTASH_CURRENT_SIGNING_KEY e QSTASH_NEXT_SIGNING_KEY são obrigatórias.");
}

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(200).send('OK'); // Responde a verificações GET
    }

    let untrustedPayload: any;

    try {
        const rawBody = await getRawBody(req);
        const rawBodyString = rawBody.toString();

        // Tenta analisar o corpo primeiro para ter dados disponíveis no bloco catch
        try {
            untrustedPayload = JSON.parse(rawBodyString);
        } catch (e) {
            console.error("Falha ao analisar o corpo do QStash como JSON:", rawBodyString);
            return res.status(400).json({ success: false, error: "Corpo JSON inválido" });
        }

        // Agora, verifica a assinatura. Se falhar, o bloco catch principal será acionado.
        const payload = await receiver.verify({
            signature: req.headers['upstash-signature'] as string,
            body: rawBodyString,
        });

        const { teamId, campaignId, templateId, variables, recipient, userId } = payload;
        
        const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        if (profileError || !profile) {
            throw new Error(`Perfil não encontrado para o usuário ${userId}`);
        }
        
        const { data: templateData, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
        const template = templateData as unknown as MessageTemplate;
        if (templateError || !template) throw new Error(`Template com ID ${templateId} não encontrado.`);
        if (!template.meta_id) throw new Error(`Template '${template.template_name}' não está sincronizado com a Meta.`);
        
        const metaConfig = getMetaConfig(profile);
        const metaTemplateDetails = await getMetaTemplateById(metaConfig, template.meta_id);

        const context = { contact: recipient, trigger: null };
        const resolvePlaceholder = (placeholder: string) => {
            const rawValue = placeholder === '{{1}}' ? '{{contact.name}}' : (variables[placeholder] || '');
            return resolveVariables(rawValue, context);
        };

        const finalComponents: any[] = [];
        const templateComponents = template.components || [];

        const headerComponent = templateComponents.find(c => c.type === 'HEADER');
        if (headerComponent?.text) {
            const placeholders = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
            if (placeholders.length > 0) {
                finalComponents.push({ type: 'header', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
            }
        }

        const bodyComponent = templateComponents.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const placeholders = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
            if (placeholders.length > 0) {
                finalComponents.push({ type: 'body', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
            }
        }
        
        const buttonsComponent = templateComponents.find(c => c.type === 'BUTTONS');
        if (buttonsComponent?.buttons) {
            buttonsComponent.buttons.forEach((button, index) => {
                if (button.type === 'URL' && button.url) {
                    const placeholders = button.url.match(/\{\{\d+\}\}/g) || [];
                    if (placeholders.length > 0) {
                        const parameters = placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) }));
                        finalComponents.push({
                            type: 'button',
                            sub_type: 'url',
                            index: String(index),
                            parameters: parameters,
                        });
                    }
                }
            });
        }
        
        const response = await sendTemplatedMessage(metaConfig, recipient.phone, metaTemplateDetails.name, metaTemplateDetails.language, finalComponents.length > 0 ? finalComponents : undefined);

        let resolvedContent = bodyComponent?.text || `[Template: ${template.template_name}]`;
        const placeholdersInBody = resolvedContent.match(/\{\{\d+\}\}/g) || [];
        for (const placeholder of placeholdersInBody) {
             resolvedContent = resolvedContent.replace(placeholder, resolvePlaceholder(placeholder));
        }
        
        await supabaseAdmin
            .from('messages')
            .update({
                status: 'sent',
                meta_message_id: response.messages[0].id,
                sent_at: new Date().toISOString(),
                content: resolvedContent,
            })
            .eq('campaign_id', campaignId)
            .eq('contact_id', recipient.id);

        res.status(200).json({ success: true, messageId: response.messages[0].id });

    } catch (error: any) {
        console.error("Erro no worker send-single-message:", error.message);
        
        if (untrustedPayload) {
            const { campaignId, recipient } = untrustedPayload;
            if (campaignId && recipient?.id) {
                await supabaseAdmin
                    .from('messages')
                    .update({ status: 'failed', error_message: error.message })
                    .eq('campaign_id', campaignId)
                    .eq('contact_id', recipient.id);
            }
        }
        
        res.status(500).json({ success: false, error: error.message });
    }
}