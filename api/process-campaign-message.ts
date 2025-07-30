import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verify } from "@upstash/qstash/verify";
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { getRawBody } from './_lib/webhook/parser.js';
import { getMetaConfig, resolveVariables } from './_lib/automation/helpers.js';
import { sendTemplatedMessage } from './_lib/meta/messages.js';
import { getMetaTemplateById } from './_lib/meta/templates.js';
import { MessageTemplate } from './_lib/types.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { messageId, userId, variables } = req.body;

        if (!messageId || !userId || !variables) {
            return res.status(400).json({ error: 'Missing required parameters in body.' });
        }

        const { data: message, error: msgError } = await supabaseAdmin
            .from('messages')
            .select('*, contacts(*), campaigns(*), message_templates(*)')
            .eq('id', messageId)
            .single();

        if (msgError || !message) {
            throw new Error(`Message or related data not found for ID ${messageId}: ${msgError?.message}`);
        }
        
        if (message.status !== 'pending') {
            console.warn(`Skipping message ${messageId} as its status is '${message.status}', not 'pending'.`);
            return res.status(200).json({ message: 'Skipped, already processed.' });
        }

        const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
        if (profileError || !profile) throw new Error(`Profile not found for user ${userId}`);

        const metaConfig = getMetaConfig(profile as any);
        const contact = message.contacts as any;
        const template = message.message_templates as any as MessageTemplate;

        if (!contact || !template || !template.meta_id) {
            throw new Error(`Contact or template invalid for message ${messageId}`);
        }
        
        const metaTemplateDetails = await getMetaTemplateById(metaConfig, template.meta_id);

        const context = { contact, trigger: null }; // Trigger is null for campaigns
        const resolvePlaceholder = (p: string) => resolveVariables(p === '{{1}}' ? '{{contact.name}}' : (variables[p] || ''), context);

        const finalComponents = [];
        const header = template.components.find(c => c.type === 'HEADER');
        if (header?.text) {
            const placeholders = header.text.match(/\{\{\d+\}\}/g) || [];
            if (placeholders.length > 0) finalComponents.push({ type: 'header', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
        }
        const body = template.components.find(c => c.type === 'BODY');
        if (body?.text) {
            const placeholders = body.text.match(/\{\{\d+\}\}/g) || [];
            if (placeholders.length > 0) finalComponents.push({ type: 'body', parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
        }
        const buttons = template.components.find(c => c.type === 'BUTTONS');
        if (buttons?.buttons) {
            buttons.buttons.forEach((btn, index) => {
                if (btn.type === 'URL' && btn.url) {
                    const placeholders = btn.url.match(/\{\{\d+\}\}/g) || [];
                    if (placeholders.length > 0) finalComponents.push({ type: 'button', sub_type: 'url', index: String(index), parameters: placeholders.map(p => ({ type: 'text', text: resolvePlaceholder(p) })) });
                }
            });
        }
        
        let resolvedContent = body?.text || '';
        (resolvedContent.match(/\{\{\d+\}\}/g) || []).forEach(p => {
             resolvedContent = resolvedContent.replace(p, resolvePlaceholder(p));
        });

        const response = await sendTemplatedMessage(metaConfig, contact.phone, metaTemplateDetails.name, metaTemplateDetails.language, finalComponents.length > 0 ? finalComponents : undefined);
        
        await supabaseAdmin.from('messages').update({
            status: 'sent',
            meta_message_id: response.messages[0].id,
            sent_at: new Date().toISOString(),
            content: resolvedContent,
        }).eq('id', messageId);

        // Check if this was the last message to update campaign status
        const campaign = message.campaigns as any;
        if (campaign) {
            const { count } = await supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'pending');
            if (count === 0) {
                 await supabaseAdmin.from('campaigns').update({ status: 'Sent' }).eq('id', campaign.id);
            }
        }

        res.status(200).json({ success: true });

    } catch (err: any) {
        console.error(`Error processing message ${req.body?.messageId}:`, err);
        // Update message to failed
        if(req.body?.messageId) {
            await supabaseAdmin.from('messages').update({ status: 'failed', error_message: err.message }).eq('id', req.body.messageId);
        }
        res.status(500).json({ error: 'Failed to process campaign message.', details: err.message });
    }
};

const verifiedHandler = async (req: VercelRequest, res: VercelResponse) => {
  const rawBody = await getRawBody(req);
  const signature = req.headers["upstash-signature"];

  if (!signature || typeof signature !== 'string') {
      return res.status(401).send("Signature missing");
  }

  const isValid = await verify({
    signature,
    body: rawBody.toString('utf-8'),
    url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}${req.url}` : undefined,
  });

  if (!isValid) {
      return res.status(401).send("Invalid signature");
  }
  
  // Attach parsed body for the main handler
  if (rawBody.length > 0) {
    req.body = JSON.parse(rawBody.toString('utf-8'));
  }

  return handler(req, res);
};

export default verifiedHandler;
