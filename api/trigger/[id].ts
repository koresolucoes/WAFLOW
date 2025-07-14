
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { executeAutomation } from '../_lib/engine';
import { Contact, Automation } from '../../src/types';

const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id: rawId } = req.query;

    if (typeof rawId !== 'string' || !rawId.includes('_')) {
        return res.status(400).json({ error: 'Invalid trigger ID format.' });
    }

    const lastUnderscoreIndex = rawId.lastIndexOf('_');
    const webhookPrefix = rawId.substring(0, lastUnderscoreIndex);
    const nodeId = rawId.substring(lastUnderscoreIndex + 1);

    // 1. Find Profile and Automation
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('webhook_path_prefix', webhookPrefix)
        .single();

    if (!profile) {
        return res.status(404).json({ error: 'Profile not found for this webhook prefix.' });
    }

    const { data: automations } = await supabaseAdmin
        .from('automations')
        .select('*')
        .eq('user_id', profile.id);
        
    const automation = (automations as unknown as Automation[])?.find(a => a.nodes?.some(n => n.id === nodeId));

    if (!automation) {
        return res.status(404).json({ error: 'Automation not found for this trigger ID.' });
    }

    const triggerNode = automation.nodes.find(n => n.id === nodeId);
    if (!triggerNode || triggerNode.data.type !== 'webhook_received') {
        return res.status(400).json({ error: 'Invalid trigger node.' });
    }

    // 2. Extract payload
    const payload = req.method === 'POST' ? req.body : req.query;
    
    // 3. Handle "Listening Mode" for UI setup
    const config = (triggerNode.data.config || {}) as any;
    if (config.last_captured_data === null) {
        const { error: updateError } = await supabaseAdmin
            .from('automations')
            .update({
                nodes: automation.nodes.map(n => 
                    n.id === nodeId ? { ...n, data: { ...n.data, config: { ...config, last_captured_data: payload } } } : n
                )
            })
            .eq('id', automation.id);
        
        if (updateError) {
             return res.status(500).json({ error: 'Failed to save captured data.', details: updateError.message });
        }
        return res.status(200).json({ message: 'Webhook data captured successfully. You can now configure mapping in the editor.' });
    }

    // 4. Execute Automation: Map data and find/create contact
    const mappingRules = config.data_mapping || [];
    const phoneRule = mappingRules.find((m: any) => m.destination === 'phone');
    if (!phoneRule) {
        return res.status(400).json({ error: 'Data mapping for contact phone number is not configured.' });
    }
    
    const phone = String(getValueFromPath(payload, phoneRule.source)).replace(/\D/g, '');
    if (!phone) {
        return res.status(400).json({ error: 'Could not extract phone number from payload using mapping rules.' });
    }

    // Find or create contact
    let { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('phone', phone)
        .single();
    
    let isNewContact = false;
    if (!contact) {
        isNewContact = true;
        const nameRule = mappingRules.find((m: any) => m.destination === 'name');
        const name = nameRule ? getValueFromPath(payload, nameRule.source) : 'New Webhook Lead';
        const { data: newContact, error } = await supabaseAdmin.from('contacts').insert({ user_id: profile.id, name, phone }).select().single();
        if (error || !newContact) {
            return res.status(500).json({ error: 'Failed to create new contact.' });
        }
        contact = newContact;
    }

    // Apply other mapping rules (tags, custom fields)
    const newTags = new Set(contact.tags || []);
    const newCustomFields = { ...(contact.custom_fields as object || {}) };
    let needsUpdate = false;

    mappingRules.forEach((rule: any) => {
        const value = getValueFromPath(payload, rule.source);
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
        const { data: updatedContact } = await supabaseAdmin.from('contacts').update({ tags: Array.from(newTags), custom_fields: newCustomFields }).eq('id', contact.id).select().single();
        if(updatedContact) contact = updatedContact;
    }

    // 5. Trigger the automation engine
    executeAutomation(automation, contact as Contact, nodeId, payload);
    
    // Trigger "New Contact" automations if applicable
    if (isNewContact) {
         const { data: newContactAutomations } = await supabaseAdmin.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active');
         if (newContactAutomations) {
            for (const auto of (newContactAutomations as unknown as Automation[])) {
                const trigger = auto.nodes?.find(n => n.data.type === 'new_contact');
                if (trigger) {
                    executeAutomation(auto, contact as Contact, trigger.id, null);
                }
            }
         }
    }


    return res.status(202).json({ message: 'Automation triggered.' });
}
