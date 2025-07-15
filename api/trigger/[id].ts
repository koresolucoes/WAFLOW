





import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { executeAutomation } from '../_lib/engine.js';
import { Contact, Automation, TablesInsert } from '../_lib/types.js';

const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id: rawId } = req.query;

    if (typeof rawId !== 'string' || !rawId.includes('_')) {
        return res.status(400).json({ error: 'Invalid trigger ID format.' });
    }

    const firstUnderscoreIndex = rawId.indexOf('_');
    if (firstUnderscoreIndex === -1) {
        return res.status(400).json({ error: 'Invalid trigger ID format: separator not found.' });
    }
    const webhookPrefix = rawId.substring(0, firstUnderscoreIndex);
    const nodeId = rawId.substring(firstUnderscoreIndex + 1);

    const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`webhook_path_prefix.eq.${webhookPrefix},id.eq.${webhookPrefix}`)
        .limit(1)
        .single();

    if (profileError || !profileData) {
        return res.status(404).json({ error: 'Profile not found for this webhook prefix or ID.' });
    }
    const profile = profileData;

    const { data: automations, error: automationsError } = await supabaseAdmin
        .from('automations')
        .select('*')
        .eq('user_id', profile.id);
    
    if(automationsError || !automations) {
         return res.status(500).json({ error: 'Failed to retrieve automations.' });
    }
        
    const automation = (automations as unknown as Automation[])?.find(a => a.nodes?.some(n => n.id === nodeId));

    if (!automation) {
        return res.status(404).json({ error: 'Automation not found for this trigger ID.' });
    }

    const triggerNode = automation.nodes.find(n => n.id === nodeId);
    if (!triggerNode || triggerNode.data.type !== 'webhook_received') {
        return res.status(400).json({ error: 'Invalid trigger node.' });
    }

    // --- Structured Payload Parsing ---
    const structuredPayload = {
        body: req.body || {},
        query: req.query || {},
        headers: req.headers || {},
    };

    // 3. Handle "Listening Mode" for UI setup
    const config = (triggerNode.data.config || {}) as any;
    if (config.last_captured_data === null) {
        const { error: updateError } = await supabaseAdmin
            .from('automations')
            .update({
                nodes: automation.nodes.map(n => 
                    n.id === nodeId ? { ...n, data: { ...n.data, config: { ...config, last_captured_data: structuredPayload } } } : n
                )
            })
            .eq('id', automation.id);
        
        if (updateError) {
             return res.status(500).json({ error: 'Failed to save captured data.', details: updateError.message });
        }
        return res.status(200).json({ message: 'Webhook data captured successfully. You can now configure mapping in the editor.' });
    }

    // 4. Execute Automation (handles single or batch payloads)
    const events = Array.isArray(structuredPayload.body) ? structuredPayload.body : [structuredPayload.body];
    const mappingRules = config.data_mapping || [];
    const phoneRule = mappingRules.find((m: any) => m.destination === 'phone');

    if (!phoneRule) {
        return res.status(400).json({ error: 'Data mapping for contact phone number is not configured.' });
    }

    for (const eventBody of events) {
        // We create a full payload for each event in a batch
        const fullPayloadForEvent = {
            ...structuredPayload,
            body: eventBody
        };

        const phone = String(getValueFromPath(fullPayloadForEvent, phoneRule.source)).replace(/\D/g, '');
        if (!phone) {
            console.warn('Could not extract phone number from event, skipping:', fullPayloadForEvent);
            continue;
        }

        let { data: contactData, error: contactError } = await supabaseAdmin
            .from('contacts')
            .select('*')
            .eq('user_id', profile.id)
            .eq('phone', phone)
            .single();
        
        let contact: Contact | null = contactData as Contact | null;
        let isNewContact = false;
        
        if (contactError && contactError.code === 'PGRST116') { // not found
            isNewContact = true;
            const nameRule = mappingRules.find((m: any) => m.destination === 'name');
            const name = nameRule ? getValueFromPath(fullPayloadForEvent, nameRule.source) : 'New Webhook Lead';
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert({ user_id: profile.id, name, phone } as TablesInsert<'contacts'>).select().single();
            if (insertError || !newContact) {
                console.error('Failed to create new contact for webhook trigger.', insertError);
                continue;
            }
            contact = newContact as unknown as Contact;
        } else if (contactError) {
            console.error('Failed to query contact.', contactError);
            continue;
        }

        if (!contact) continue;

        const newTags = new Set(contact.tags || []);
        const newCustomFields = { ...(contact.custom_fields as object || {}) };
        let needsUpdate = false;

        mappingRules.forEach((rule: any) => {
            const value = getValueFromPath(fullPayloadForEvent, rule.source);
            if (value === undefined) return;

            if (rule.destination === 'tag') {
                newTags.add(String(value));
                needsUpdate = true;
            } else if (rule.destination === 'custom_field' && rule.destination_key) {
                (newCustomFields as any)[rule.destination_key] = value;
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            const { data: updatedContact, error: updateContactError } = await supabaseAdmin.from('contacts').update({ tags: Array.from(newTags), custom_fields: newCustomFields }).eq('id', contact.id).select().single();
            if(updateContactError) {
                console.error("Failed to update contact with webhook data", updateContactError);
            } else if(updatedContact) {
                 contact = updatedContact as unknown as Contact;
            }
        }
        
        if (!contact) continue;

        // Non-blocking call to the engine
        executeAutomation(automation, contact, nodeId, fullPayloadForEvent);
        
        if (isNewContact) {
             const { data: newContactAutomations } = await supabaseAdmin.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active');
             if (newContactAutomations) {
                for (const auto of (newContactAutomations as unknown as Automation[])) {
                    const trigger = auto.nodes?.find(n => n.data.type === 'new_contact');
                    if (trigger) {
                        executeAutomation(auto, contact, trigger.id, null);
                    }
                }
             }
        }
    }

    return res.status(202).json({ message: 'Automation triggered.' });
}