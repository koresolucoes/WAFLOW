

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { executeAutomation, createDefaultLoggingHooks } from '../_lib/automation/engine.js';
import { publishEvent } from '../_lib/automation/trigger-handler.js';
import { Automation, Profile } from '../_lib/types.js';
import { getRawBody, parseMultipartFormData } from '../_lib/webhook/parser.js';
import { processWebhookPayloadForContact } from '../_lib/webhook/contact-mapper.js';
import { sanitizeAutomation } from '../_lib/automation/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id: rawId } = req.query;

    if (typeof rawId !== 'string') {
        return res.status(400).json({ error: 'Invalid trigger ID format.' });
    }

    const separator = '__';
    const separatorIndex = rawId.indexOf(separator);
    if (separatorIndex === -1) {
        return res.status(400).json({ error: `Invalid trigger ID format. Expected separator "${separator}" not found.` });
    }

    const webhookPrefix = rawId.substring(0, separatorIndex);
    const nodeId = rawId.substring(separatorIndex + separator.length);

    let profileData: Profile | null = null;

    // Robust Profile Lookup: First try by the custom path prefix.
    const { data: profileByPrefix } = await supabaseAdmin.from('profiles').select().eq('webhook_path_prefix', webhookPrefix).maybeSingle();
    if (profileByPrefix) {
        profileData = profileByPrefix as Profile;
    } else {
        // As a fallback, check if the prefix was actually a user ID.
        const { data: profileById } = await supabaseAdmin.from('profiles').select().eq('id', webhookPrefix).maybeSingle();
        if (profileById) {
            profileData = profileById as Profile;
        }
    }
    
    if (!profileData) {
        return res.status(404).json({ error: `Profile not found for webhook prefix or ID: "${webhookPrefix}"` });
    }
    const profile = profileData;

    const { data: automationsData, error: automationsError } = await supabaseAdmin.from('automations').select().eq('user_id', profile.id).eq('status', 'active');
    
    if(automationsError || !automationsData) {
         return res.status(500).json({ error: 'Failed to retrieve automations.' });
    }
    
    const automations = (automationsData as Automation[]) || [];
    const rawAutomation = automations.find(a => (a.nodes || []).some(n => n.id === nodeId));

    if (!rawAutomation) {
        return res.status(404).json({ error: 'Automation not found for this trigger ID.' });
    }
    
    const automation = sanitizeAutomation(rawAutomation);

    const triggerNode = automation.nodes.find(n => n.id === nodeId);
    if (!triggerNode || triggerNode.data.type !== 'webhook_received') {
        return res.status(400).json({ error: 'Invalid trigger node.' });
    }

    const contentType = req.headers['content-type'] || '';
    let body: any = {};

    // Manually parse body if not JSON, as Vercel's default parser might not handle it.
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        try {
            const rawBodyBuffer = await getRawBody(req);
            const rawBody = rawBodyBuffer.toString('utf-8');

            if (contentType.includes('application/json') && rawBody) {
                body = JSON.parse(rawBody);
            } else if (contentType.includes('application/x-www-form-urlencoded') && rawBody) {
                body = Object.fromEntries(new URLSearchParams(rawBody));
            } else if (contentType.includes('multipart/form-data')) {
                const boundaryMatch = contentType.match(/boundary=(.+)/);
                if (boundaryMatch) {
                    const boundary = boundaryMatch[1];
                    body = parseMultipartFormData(rawBodyBuffer, boundary);
                }
            } else if (rawBody) {
                // Fallback for plain text or other types
                 try {
                   body = JSON.parse(rawBody)
                 } catch (e) {
                   body = { raw: rawBody };
                 }
            }
        } catch(e: any) {
            console.error('Error parsing request body:', e.message);
            // Don't fail the request, proceed with an empty body
            body = {};
        }
    }


    const structuredPayload = {
        body: body,
        query: req.query || {},
        headers: req.headers || {},
    };

    const config = (triggerNode.data.config || {}) as any;

    // "Listen" mode: Capture data and broadcast to the client editor.
    if (config.is_listening === true) {
        try {
            const channel = supabaseAdmin.channel(`automation-editor-${automation.id}`);
            await channel.send({
                type: 'broadcast',
                event: 'webhook_captured',
                payload: { nodeId: nodeId, data: structuredPayload }
            });
            // We don't need to keep the channel open on the server
            await supabaseAdmin.removeChannel(channel);

            return res.status(200).json({ message: 'Webhook data captured successfully. You can now configure mapping in the editor.' });

        } catch(broadcastError: any) {
            console.error('Webhook trigger: Failed to broadcast captured data.', broadcastError);
            return res.status(500).json({ error: 'Failed to broadcast captured data to the editor.', details: broadcastError.message });
        }
    }

    // "Production" mode: Process data and run automation
    const events = Array.isArray(structuredPayload.body) ? structuredPayload.body : [structuredPayload.body];
    const mappingRules = config.data_mapping || [];

    for (const eventBody of events) {
        try {
            const fullPayloadForEvent = { ...structuredPayload, body: eventBody };
            
            const { contact, isNewContact, newlyAddedTags } = await processWebhookPayloadForContact(profile, fullPayloadForEvent, mappingRules);
            
            const hooks = createDefaultLoggingHooks(automation.id, contact ? contact.id : null);
            // CRITICAL FIX: Await the execution to ensure completion in the serverless environment.
            await executeAutomation(automation, contact, nodeId, fullPayloadForEvent, hooks, profile);
            
            // Await side-effect events as well for maximum reliability
            const sideEffectPromises: Promise<void>[] = [];
            if (contact) {
                if (isNewContact) {
                    sideEffectPromises.push(publishEvent('contact_created', profile.id, { contact }));
                }
                newlyAddedTags.forEach(tag => {
                    sideEffectPromises.push(publishEvent('tag_added', profile.id, { contact, tag }));
                });
            }
            await Promise.all(sideEffectPromises);
        
        } catch (e: any) {
            console.error(`Webhook trigger: Error processing event in loop: ${e.message}`);
             // If one event in a batch fails, log it and continue to the next
        }
    }

    return res.status(200).json({ message: 'Automation executed successfully.' });
}