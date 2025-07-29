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

// Verifique se as chaves de assinatura estão definidas
if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    throw new Error("As variáveis de ambiente QSTASH_CURRENT_SIGNING_KEY e QSTASH_NEXT_SIGNING_KEY são obrigatórias.");
}

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Adicionado para lidar com a verificação de endpoint do QStash que usa GET
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(200).send('OK');
    }

    let payload;
    try {
        const rawBody = await getRawBody(req);
        payload = await receiver.verify({
            signature: req.headers['upstash-signature'] as string,
            body: rawBody.toString(),
        });

        const { teamId, campaignId, templateId, variables, recipient, userId } = payload;
        
        // 1. Obter perfil para a configuração da Meta
        const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        if (profileError || !profile) {
            throw new Error(`Perfil não encontrado para o usuário ${userId}`);
        }
        
        // 2. Obter o template
        const { data: templateData, error: templateError } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
        const template = templateData as unknown as MessageTemplate;
        if (templateError || !template) throw new Error(`Template com ID ${templateId} não encontrado.`);
        if (!template.meta_id) throw new Error(`Template '${template.template_name}' não está sincronizado com a Meta.`);
        
        // 3. Preparar e enviar a mensagem via API da Meta
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
        
        const response = await sendTemplatedMessage(metaConfig, recipient.phone, metaTemplateDetails.name, metaTemplateDetails.language, finalComponents.length > 0 ? finalComponents : undefined);

        // 4. Atualizar o status da mensagem no BD para 'sent'
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
        
        // Tenta atualizar a mensagem para 'failed'
        if (payload) {
            const { campaignId, recipient } = payload;
            if (campaignId && recipient?.id) {
                await supabaseAdmin
                    .from('messages')
                    .update({ status: 'failed', error_message: error.message })
                    .eq('campaign_id', campaignId)
                    .eq('contact_id', recipient.id);
            }
        }
        
        // Responde com erro para que o QStash possa tentar novamente, se configurado
        res.status(500).json({ success: false, error: error.message });
    }
}
