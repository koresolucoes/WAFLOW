
import { supabaseAdmin } from '../supabaseAdmin.js';
import { Contact, Profile, Json } from '../types.js';
import { TablesInsert, TablesUpdate } from '../database.types.js';
import { getValueFromPath } from '../automation/helpers.js';

const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // 1. Strip all non-numeric characters.
    let digits = phone.replace(/\D/g, '');

    // 2. Handle local Brazilian numbers (without country code)
    if (digits.length === 10) { // DDD + 8-digit number, likely a mobile missing the '9'
        const ddd = digits.substring(0, 2);
        const number = digits.substring(2);
        return `55${ddd}9${number}`;
    }
    if (digits.length === 11) { // DDD + 9-digit number
        return `55${digits}`;
    }

    // 3. Handle numbers with Brazilian country code
    if (digits.startsWith('55')) {
        // 55 + DDD + 8-digit number. This is a mobile missing the '9'.
        if (digits.length === 12) {
            const ddd = digits.substring(2, 4);
            const number = digits.substring(4);
            return `55${ddd}9${number}`;
        }
    }
    
    // 4. Return as is for other cases (already correct, or not a Brazilian mobile)
    return digits;
};

export const findOrCreateContactByPhone = async (user_id: string, phone: string, name: string): Promise<{ contact: Contact, isNew: boolean }> => {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    let { data: contactData, error } = await supabaseAdmin
        .from('contacts')
        .select('company, created_at, custom_fields, email, id, name, phone, tags, user_id, inbox_status')
        .eq('user_id', user_id)
        .eq('phone', normalizedPhone)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
        const newContactPayload: TablesInsert<'contacts'> = { user_id, phone: normalizedPhone, name, tags: ['new-lead'], custom_fields: null, inbox_status: 'Aberta' };
        const { data: newContact, error: insertError } = await supabaseAdmin
            .from('contacts')
            .insert(newContactPayload)
            .select('company, created_at, custom_fields, email, id, name, phone, tags, user_id, inbox_status')
            .single();
        if (insertError) {
             console.error("Error creating new contact:", insertError);
             throw insertError;
        }
        if (!newContact) {
            throw new Error("Failed to create new contact and retrieve it.");
        }
        return { contact: newContact as Contact, isNew: true };
    } else if (error) {
         console.error("Error finding contact:", error);
        throw error;
    }
    
    if(!contactData) throw new Error("Contact data is null after query.");

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
        const newCustomFields: { [key: string]: any } = { ...(contact.custom_fields as object || {}) };
        let needsUpdate = false;

        const updatePayload: TablesUpdate<'contacts'> = {};

        mappingRules.forEach((rule: any) => {
            if (!rule.source || rule.destination === 'phone') return;
            const value = getValueFromPath(fullPayloadForEvent, rule.source);
            if (value === undefined) return;
            
            if (rule.destination === 'name' && contact?.name !== value) {
                updatePayload.name = value;
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
                if (newCustomFields[rule.destination_key] !== value) {
                    newCustomFields[rule.destination_key] = value;
                    needsUpdate = true;
                }
            }
        });
        
        const finalTags = Array.from(newTags);
        if (JSON.stringify(finalTags) !== JSON.stringify(contact.tags || [])) {
            updatePayload.tags = finalTags;
            needsUpdate = true;
        }

        const finalCustomFields = newCustomFields as Json;
        if (JSON.stringify(finalCustomFields) !== JSON.stringify(contact.custom_fields || {})) {
            updatePayload.custom_fields = finalCustomFields;
            needsUpdate = true;
        }

        if (needsUpdate) {
            const { data: updatedContact, error: updateContactError } = await supabaseAdmin
                .from('contacts')
                .update(updatePayload)
                .eq('id', contact.id)
                .select('company, created_at, custom_fields, email, id, name, phone, tags, user_id, inbox_status')
                .single();

            if(updateContactError) {
                console.error("Webhook trigger: Failed to update contact with data", updateContactError)
            } else if(updatedContact) {
                contact = updatedContact as Contact;
            }
        }
    }

    return { contact, isNewContact, newlyAddedTags };
};
