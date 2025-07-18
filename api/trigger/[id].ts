

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { executeAutomation } from '../_lib/engine.js';
import { handleNewContactEvent, handleTagAddedEvent } from '../_lib/automation/trigger-handler.js';
import { Contact, Automation, Profile, Json, TablesInsert } from '../_lib/types.js';

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

    const { data: profileByPrefix } = await supabaseAdmin.from('profiles').select('*').eq('webhook_path_prefix', webhookPrefix).maybeSingle();
    if (profileByPrefix) {
        profileData = profileByPrefix as any as Profile;
    } else {
        const { data: profileById } = await supabaseAdmin.from('profiles').select('*').eq('id', webhookPrefix).maybeSingle();
        if (profileById) {
            profileData = profileById as any as Profile;
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
    
    const automations = (automationsData as any as Automation[]) || [];
    const automation = automations.find(a => a.nodes?.some(n => n.id === nodeId));

    if (!automation) {
        return res.status(404).json({ error: 'Automation not found for this trigger ID.' });
    }

    const triggerNode = automation.nodes.find(n => n.id === nodeId);
    if (!triggerNode || triggerNode.data.type !== 'webhook_received') {
        return res.status(400).json({ error: 'Invalid trigger node.' });
    }

    const structuredPayload = {
        body: req.body || {},
        query: req.query || {},
        headers: req.headers || {},
    };

    const config = (triggerNode.data.config || {}) as any;

    // "Listen" mode: Capture data and stop
    if (config.is_listening === true) {
        const updatedConfig = {
            ...config,
            last_captured_data: structuredPayload,
            is_listening: false,
        };
        const updatedNodes = automation.nodes.map(n => 
            n.id === nodeId ? { ...n, data: { ...n.data, config: updatedConfig } } : n
        );
        const { error: updateError } = await supabaseAdmin
            .from('automations')
            .update({ nodes: updatedNodes as Json } as any)
            .eq('id', automation.id);
        
        if (updateError) {
             return res.status(500).json({ error: 'Failed to save captured data.', details: updateError.message });
        }
        return res.status(200).json({ message: 'Webhook data captured successfully. You can now configure mapping in the editor.' });
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
                        const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(newContactPayload).select().single();
                        if (insertError) {
                            console.error('Webhook trigger: Failed to create new contact.', insertError);
                        } else if (newContact) {
                            contact = newContact as any as Contact;
                        }
                    } else if (contactError) {
                        console.error('Webhook trigger: Failed to query contact.', contactError);
                    } else if (contactData) {
                        contact = contactData as any as Contact;
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
                        contact = updatedContact as any as Contact;
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