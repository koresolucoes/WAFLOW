


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { executeAutomation } from '../_lib/engine.js';
import { handleNewContactEvent, handleTagAddedEvent } from '../_lib/automation/trigger-handler.js';
import { Contact, Automation, Profile, Json, TablesInsert, TablesUpdate } from '../_lib/types.js';

// @ts-ignore
declare const Buffer: any;

// Function to read the raw body from the request, as Vercel's body parser
// might not handle all content types or might have already consumed the stream.
const getRawBody = (req: VercelRequest): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
};

// A very basic multipart/form-data parser.
// This is simplified and only handles non-file fields.
const parseMultipartFormData = (body: Buffer, boundary: string): Record<string, string> => {
  const bodyString = body.toString();
  const parts = bodyString.split(`--${boundary}`).slice(1, -1);
  const result: Record<string, string> = {};

  for (const part of parts) {
    const headerMatch = part.match(/Content-Disposition: form-data; name="([^"]+)"/);
    if (headerMatch) {
      const name = headerMatch[1];
      const content = part.split('\r\n\r\n')[1];
      if (content) {
        // Remove the final carriage return and newline
        result[name] = content.trimEnd();
      }
    }
  }
  return result;
};


const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    const cleanPath = path.replace(/\{\{|\}\}/g, '').trim();
    return cleanPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

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
    const { data: profileByPrefix } = await supabaseAdmin.from('profiles').select('*').eq('webhook_path_prefix', webhookPrefix).maybeSingle();
    if (profileByPrefix) {
        profileData = profileByPrefix as unknown as Profile;
    } else {
        // As a fallback, check if the prefix was actually a user ID.
        const { data: profileById } = await supabaseAdmin.from('profiles').select('*').eq('id', webhookPrefix).maybeSingle();
        if (profileById) {
            profileData = profileById as unknown as Profile;
        }
    }
    
    if (!profileData) {
        return res.status(404).json({ error: `Profile not found for webhook prefix or ID: "${webhookPrefix}"` });
    }
    const profile = profileData;

    const { data: automationsData, error: automationsError } = await supabaseAdmin.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active');
    
    if(automationsError || !automationsData) {
         return res.status(500).json({ error: 'Failed to retrieve automations.' });
    }
    
    const automations = (automationsData as unknown as Automation[]) || [];
    const automation = automations.find(a => a.nodes?.some(n => n.id === nodeId));

    if (!automation) {
        return res.status(404).json({ error: 'Automation not found for this trigger ID.' });
    }

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
    const phoneRule = mappingRules.find((m: any) => m.destination === 'phone');

    for (const eventBody of events) {
        try {
            const fullPayloadForEvent = { ...structuredPayload, body: eventBody };
            let contact: Contact | null = null;
            let isNewContact = false;
            let originalTags = new Set<string>();

            if (phoneRule && phoneRule.source) {
                const phoneValue = getValueFromPath(fullPayloadForEvent, phoneRule.source);
                const phone = phoneValue ? String(phoneValue).replace(/\D/g, '') : null;

                if (phone) {
                    let { data: contactData, error: contactError } = await supabaseAdmin.from('contacts').select('*').eq('user_id', profile.id).eq('phone', phone).single();
                    
                    if (contactError && contactError.code === 'PGRST116') { // not found
                        isNewContact = true;
                        const nameRule = mappingRules.find((m: any) => m.destination === 'name');
                        const name = nameRule ? getValueFromPath(fullPayloadForEvent, nameRule.source) : 'New Webhook Lead';
                        const newContactPayload: TablesInsert<'contacts'> = { user_id: profile.id, name, phone, tags: ['new-webhook-lead'], custom_fields: null };
                        const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(newContactPayload as any).select().single();
                        if (insertError) {
                            console.error('Webhook trigger: Failed to create new contact.', insertError);
                        } else if (newContact) {
                            contact = newContact as unknown as Contact;
                        }
                    } else if (contactError) {
                        console.error('Webhook trigger: Failed to query contact.', contactError);
                    } else if (contactData) {
                        contact = contactData as unknown as Contact;
                        if(contact) originalTags = new Set(contact.tags || []);
                    }
                }
            }
            
            const newlyAddedTags = new Set<string>();
            if (contact) {
                const newTags = new Set(contact.tags || []);
                const newCustomFields = { ...(contact.custom_fields as object || {}) };
                let needsUpdate = false;

                mappingRules.forEach((rule: any) => {
                    if (!rule.source || rule.destination === 'phone') return;
                    const value = getValueFromPath(fullPayloadForEvent, rule.source);
                    if (value === undefined) return;
                    
                    if (rule.destination === 'name' && contact?.name !== value) {
                        (contact as any).name = value;
                        needsUpdate = true;
                    } else if (rule.destination === 'tag') {
                        const tagValue = String(value);
                        if (!newTags.has(tagValue)) {
                            newTags.add(tagValue);
                            if (!originalTags.has(tagValue)) {
                                newlyAddedTags.add(tagValue);
                            }
                        }
                    } else if (rule.destination === 'custom_field' && rule.destination_key) {
                        if ((newCustomFields as any)[rule.destination_key] !== value) {
                            (newCustomFields as any)[rule.destination_key] = value;
                             needsUpdate = true;
                        }
                    }
                });
                
                const finalTags = Array.from(newTags);
                if (JSON.stringify(finalTags) !== JSON.stringify(contact.tags || [])) {
                    (contact as any).tags = finalTags;
                    needsUpdate = true;
                }
                 if (JSON.stringify(newCustomFields) !== JSON.stringify(contact.custom_fields || {})) {
                    (contact as any).custom_fields = newCustomFields as Json;
                    needsUpdate = true;
                 }

                if (needsUpdate) {
                    const { id, user_id, created_at, ...updatePayload} = contact;
                    const { data: updatedContact, error: updateContactError } = await supabaseAdmin.from('contacts').update(updatePayload as any).eq('id', contact.id).select().single();
                    if(updateContactError) {
                        console.error("Webhook trigger: Failed to update contact with data", updateContactError)
                    } else if(updatedContact) {
                        contact = updatedContact as unknown as Contact;
                    }
                }
            }

            // --- Execute automations (non-blocking) ---
            executeAutomation(automation, contact, nodeId, fullPayloadForEvent);
            
            if (contact) {
                if (isNewContact) {
                    handleNewContactEvent(profile.id, contact);
                }
                newlyAddedTags.forEach(tag => {
                    handleTagAddedEvent(profile.id, contact, tag);
                });
            }
        
        } catch (e: any) {
            console.error(`Webhook trigger: Error processing event in loop: ${e.message}`);
        }
    }

    return res.status(202).json({ message: 'Automation triggered.' });
}