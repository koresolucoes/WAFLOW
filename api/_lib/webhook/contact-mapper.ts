
import { supabaseAdmin } from '../supabaseAdmin.js';
import { Contact, Profile, Json, TablesInsert, TablesUpdate } from '../types.js';
import { getValueFromPath } from './helpers.js';

export const findOrCreateContactByPhone = async (user_id: string, phone: string, name: string): Promise<{ contact: Contact | null, isNew: boolean }> => {
    let { data: contactData, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', user_id)
        .eq('phone', phone)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
        const newContactPayload: TablesInsert<'contacts'> = { user_id, phone, name, tags: ['new-lead'], custom_fields: null };
        const { data: newContact, error: insertError } = await supabaseAdmin
            .from('contacts')
            .insert(newContactPayload)
            .select()
            .single();
        if (insertError || !newContact) {
             console.error("Error creating new contact:", insertError);
             return { contact: null, isNew: false };
        }
        return { contact: newContact as Contact, isNew: true };
    } else if (error) {
         console.error("Error finding contact:", error);
        return { contact: null, isNew: false };
    }
    return { contact: contactData as Contact, isNew: false };
};

export const processWebhookPayloadForContact = async (
    profile: Profile,
    fullPayloadForEvent: any,
    mappingRules: any[]
): Promise<{ contact: Contact | null; isNewContact: boolean; newlyAddedTags: Set<string> }> => {
    let contact: Contact | null = null;
    let isNewContact = false;
    let originalTags = new Set<string>();
    const newlyAddedTags = new Set<string>();

    const phoneRule = mappingRules.find((m: any) => m.destination === 'phone');

    if (phoneRule && phoneRule.source) {
        const phoneValue = getValueFromPath(fullPayloadForEvent, phoneRule.source);
        const phone = phoneValue ? String(phoneValue).replace(/\D/g, '') : null;

        if (phone) {
            let { data: contactData, error: contactError } = await supabaseAdmin.from('contacts').select('*').eq('user_id', profile.id).eq('phone', phone).single();
            
            if (contactError && contactError.code === 'PGRST116') { // not found
                isNewContact = true;
                const nameRule = mappingRules.find((m: any) => m.destination === 'name');
                const name = getValueFromPath(fullPayloadForEvent, nameRule?.source) || 'New Webhook Lead';
                const newContactPayload: TablesInsert<'contacts'> = { user_id: profile.id, name, phone, tags: ['new-webhook-lead'], custom_fields: null };
                const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(newContactPayload).select().single();
                if (insertError) {
                    console.error('Webhook trigger: Failed to create new contact.', insertError);
                } else if (newContact) {
                    contact = newContact as Contact;
                }
            } else if (contactError) {
                console.error('Webhook trigger: Failed to query contact.', contactError);
            } else if (contactData) {
                contact = contactData as Contact;
                if(contact) originalTags = new Set(contact.tags || []);
            }
        }
    }
    
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
            const { data: updatedContact, error: updateContactError } = await supabaseAdmin.from('contacts').update(updatePayload).eq('id', contact.id).select().single();
            if(updateContactError) {
                console.error("Webhook trigger: Failed to update contact with data", updateContactError)
            } else if(updatedContact) {
                contact = updatedContact as Contact;
            }
        }
    }

    return { contact, isNewContact, newlyAddedTags };
};
