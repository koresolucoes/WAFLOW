

import { supabaseAdmin } from '../supabaseAdmin.js';
import { Contact, Profile, Json, TablesInsert, TablesUpdate } from '../types.js';
import { getValueFromPath } from '../automation/helpers.js';

const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // 1. Strip all non-numeric characters.
    let digits = phone.replace(/\D/g, '');

    // 2. If it's a local number (e.g., 11987654321 or 3132345678), add the Brazilian country code.
    // 10 digits = DDD (2) + 8-digit number
    // 11 digits = DDD (2) + 9-digit number
    if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
    }
    
    // 3. Return the cleaned number. Do not attempt to add the 9th digit, as numbers from Meta
    // should already be in the correct E.164 format. This prevents corrupting valid numbers.
    return digits;
};

export const findOrCreateContactByPhone = async (user_id: string, phone: string, name: string): Promise<{ contact: Contact | null, isNew: boolean }> => {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    let { data: contactData, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', user_id)
        .eq('phone', normalizedPhone)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
        const newContactPayload: TablesInsert<'contacts'> = { user_id, phone: normalizedPhone, name, tags: ['new-lead'], custom_fields: null };
        const { data: newContact, error: insertError } = await supabaseAdmin
            .from('contacts')
            .insert(newContactPayload as any)
            .select('*')
            .single();
        if (insertError || !newContact) {
             console.error("Error creating new contact:", insertError);
             return { contact: null, isNew: false };
        }
        return { contact: newContact as unknown as Contact, isNew: true };
    } else if (error) {
         console.error("Error finding contact:", error);
        return { contact: null, isNew: false };
    }
    return { contact: contactData as unknown as Contact, isNew: false };
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
        const phone = phoneValue ? String(phoneValue) : null;

        if (phone) {
            // Use the findOrCreate logic which normalizes the number
            const nameRule = mappingRules.find((m: any) => m.destination === 'name');
            const name = getValueFromPath(fullPayloadForEvent, nameRule?.source) || 'New Webhook Lead';
            const { contact: foundOrCreatedContact, isNew } = await findOrCreateContactByPhone(profile.id, phone, name);
            
            contact = foundOrCreatedContact;
            isNewContact = isNew;
            if (contact && !isNew) {
                originalTags = new Set(contact.tags || []);
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
            const { data: updatedContact, error: updateContactError } = await supabaseAdmin.from('contacts').update(updatePayload as any).eq('id', contact.id).select('*').single();
            if(updateContactError) {
                console.error("Webhook trigger: Failed to update contact with data", updateContactError)
            } else if(updatedContact) {
                contact = updatedContact as unknown as Contact;
            }
        }
    }

    return { contact, isNewContact, newlyAddedTags };
};