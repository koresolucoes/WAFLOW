
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { executeAutomation } from '../../_lib/engine';
import { Contact, TablesInsert } from '../../../types';

// Main Vercel serverless function handler for custom webhooks
export default async function handler(req: Request) {
    const { pathname, searchParams } = new URL(req.url);
    const slug = pathname.substring(pathname.lastIndexOf('/') + 1);

    // Slug format is expected to be: {webhook_path_prefix}_{node_id}
    const lastUnderscoreIndex = slug.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
        return new Response('Invalid webhook URL format.', { status: 400 });
    }
    
    const webhookPrefix = slug.substring(0, lastUnderscoreIndex);
    const nodeId = slug.substring(lastUnderscoreIndex + 1);

    try {
        // 1. Find profile and automation associated with the webhook URL
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('webhook_path_prefix', webhookPrefix).single();
        if (!profile) return new Response('Webhook not found.', { status: 404 });

        const { data: automations } = await supabaseAdmin.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active');
        const automation = automations?.find(a => a.nodes?.some((n: any) => n.id === nodeId));
        if (!automation) return new Response('Automation trigger not found or is inactive.', { status: 404 });
        
        const triggerNode = automation.nodes.find((n: any) => n.id === nodeId);
        if (!triggerNode || triggerNode.data.type !== 'webhook_received') {
            return new Response('Invalid trigger node.', { status: 400 });
        }

        // 2. Get payload from the request
        const payload = req.method === 'GET' ? Object.fromEntries(searchParams) : await req.json();

        // 3. Update the node's config with the captured data for the "Listen" feature in the editor
        const nodeConfig = triggerNode.data.config as any;
        nodeConfig.last_captured_data = payload;
        
        const updatedNodes = automation.nodes.map((n: any) => n.id === nodeId ? { ...n, data: { ...n.data, config: nodeConfig } } : n);
        await supabaseAdmin.from('automations').update({ nodes: updatedNodes }).eq('id', automation.id);

        // 4. Map data to contact fields and find/create the contact
        const dataMapping = (triggerNode.data.config as any).data_mapping || [];
        const phoneRule = dataMapping.find((m: any) => m.destination === 'phone');
        const nameRule = dataMapping.find((m: any) => m.destination === 'name');
        
        const phone = phoneRule ? payload[phoneRule.source] : null;
        if (!phone) {
            console.error(`Webhook for automation ${automation.id} received, but no phone number could be mapped.`);
            return new Response('OK (phone number missing in payload mapping)', { status: 200 });
        }
        
        let contact: Contact;
        const { data: existingContact } = await supabaseAdmin.from('contacts').select('*').eq('user_id', profile.id).eq('phone', phone).single();
        
        if(existingContact) {
            contact = existingContact;
        } else {
             const name = nameRule ? payload[nameRule.source] : phone;
             const { data: newContact, error } = await supabaseAdmin.from('contacts').insert({ user_id: profile.id, phone, name }).select().single();
             if (error) throw new Error(`Could not create contact: ${error.message}`);
             contact = newContact as Contact;
        }

        // Apply other mappings (tags, custom fields)
        const newTags = new Set(contact.tags || []);
        const customFields = (contact.custom_fields as any || {});
        
        dataMapping.forEach((rule: any) => {
            if (rule.destination === 'tag') newTags.add(String(payload[rule.source]));
            if (rule.destination === 'custom_field' && rule.destination_key) {
                customFields[rule.destination_key] = payload[rule.source];
            }
        });
        
        const { data: updatedContact, error } = await supabaseAdmin
            .from('contacts')
            .update({ tags: Array.from(newTags), custom_fields: customFields })
            .eq('id', contact.id)
            .select()
            .single();

        if (error) throw new Error(`Could not update contact: ${error.message}`);

        // 5. Execute the automation
        await executeAutomation(automation as any, updatedContact as Contact, nodeId, payload);
        
        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error("Webhook trigger error:", error.message);
        // Return 500 for server errors but a generic message to the client
        return new Response('Internal Server Error', { status: 500 });
    }
}
