
import { supabase } from '../lib/supabaseClient';
import { Contact, EditableContact, ContactWithDetails, Deal, MetaConfig, MessageInsert } from '../types';
import { TablesInsert, TablesUpdate } from '../types/database.types';
import { sendTextMessage } from './meta/messages';

export const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
    }
    if (digits.length === 12 && digits.startsWith('55')) {
        const areaCode = digits.substring(2, 4);
        const numberPart = digits.substring(4);
        if (parseInt(areaCode) >= 11) {
             digits = `55${areaCode}9${numberPart}`;
        }
    }
    return digits;
};

export const fetchContactDetailsFromDb = async (userId: string, contactId: string): Promise<ContactWithDetails> => {
    const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, company, created_at, custom_fields, email, name, phone, tags, user_id')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single();

    if (contactError || !contactData) {
        throw contactError || new Error("Contato não encontrado ou acesso negado.");
    }

    const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .eq('contact_id', contactId);
    
    if (dealsError) throw dealsError;
    
    return {
        ...contactData,
        deals: (dealsData as Deal[]) || []
    };
};

export const addContactToDb = async (userId: string, contact: EditableContact): Promise<Contact> => {
    const payload: TablesInsert<'contacts'> = { ...contact, phone: normalizePhoneNumber(contact.phone), user_id: userId };
    const { data, error } = await supabase.from('contacts').insert(payload as any).select('*').single();
    if (error) throw error;
    return data;
};

export const updateContactInDb = async (userId: string, updatedContact: Contact): Promise<Contact> => {
    const updatePayload: TablesUpdate<'contacts'> = {
        name: updatedContact.name,
        phone: normalizePhoneNumber(updatedContact.phone),
        email: updatedContact.email,
        company: updatedContact.company,
        tags: updatedContact.tags,
        custom_fields: updatedContact.custom_fields,
    };

    const { data, error } = await supabase
        .from('contacts')
        .update(updatePayload as any)
        .eq('id', updatedContact.id)
        .eq('user_id', userId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
};

export const deleteContactFromDb = async (userId: string, contactId: string): Promise<void> => {
    const { error } = await supabase.from('contacts').delete().eq('id', contactId).eq('user_id', userId);
    if (error) throw error;
};

export const importContactsToDb = async (userId: string, newContacts: EditableContact[], existingPhones: Set<string>): Promise<{ imported: Contact[]; skippedCount: number }> => {
    const contactsToInsert: TablesInsert<'contacts'>[] = [];
    let skippedCount = 0;
    
    newContacts.forEach(contact => {
        const sanitizedPhone = normalizePhoneNumber(contact.phone);
        if (sanitizedPhone && !existingPhones.has(sanitizedPhone)) {
            contactsToInsert.push({ ...contact, phone: sanitizedPhone, user_id: userId, custom_fields: contact.custom_fields || null });
            existingPhones.add(sanitizedPhone);
        } else {
            skippedCount++;
        }
    });

    if (contactsToInsert.length === 0) {
        return { imported: [], skippedCount };
    }

    const { data, error } = await supabase.from('contacts').insert(contactsToInsert as any).select('*');
    if (error) throw error;
    
    return { imported: (data || []), skippedCount };
};

export const sendDirectMessagesFromApi = async (metaConfig: MetaConfig, userId: string, message: string, recipients: Contact[]): Promise<void> => {
    const messagesToInsert: MessageInsert[] = [];
    const promises = recipients.map(contact => (async () => {
        try {
            const response = await sendTextMessage(metaConfig, contact.phone, message);
            messagesToInsert.push({
                user_id: userId,
                contact_id: contact.id,
                content: message,
                meta_message_id: response.messages[0].id,
                status: 'sent',
                source: 'direct',
                type: 'outbound',
                sent_at: new Date().toISOString()
            });
        } catch (err: any) {
            console.error(`Falha ao enviar mensagem direta para ${contact.name}: ${err.message}`);
            messagesToInsert.push({
                user_id: userId,
                contact_id: contact.id,
                content: message,
                status: 'failed',
                error_message: err.message,
                source: 'direct',
                type: 'outbound'
            });
        }
    })());
    
    await Promise.all(promises);

    if (messagesToInsert.length > 0) {
        const { error } = await supabase.from('messages').insert(messagesToInsert as any);
        if (error) {
            console.error("Falha ao salvar registros de mensagens diretas enviadas:", error);
            // Don't throw here, as some messages might have been sent successfully
        }
    }
};
