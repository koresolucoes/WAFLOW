import { supabase } from '../lib/supabaseClient';
import { Contact, EditableContact, ContactWithDetails, Deal, MetaConfig, MessageInsert, TimelineEvent } from '../types';
import { TablesInsert, TablesUpdate } from '../types/database.types';
import { sendTextMessage } from './meta/messages';

export const normalizePhoneNumber = (phone: string): string => {
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

export const fetchContactDetailsFromDb = async (teamId: string, contactId: string): Promise<ContactWithDetails> => {
    const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, company, created_at, custom_fields, email, name, phone, tags, team_id')
        .eq('id', contactId)
        .eq('team_id', teamId)
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
        ...(contactData as any as Contact),
        deals: (dealsData as unknown as Deal[]) || []
    };
};

export const fetchContactTimeline = async (teamId: string, contactId: string): Promise<TimelineEvent[]> => {
    const [messagesRes, automationRunsRes, dealsRes] = await Promise.all([
        supabase.from('messages').select('id, created_at, type, content, source').eq('contact_id', contactId).eq('team_id', teamId),
        supabase.from('automation_runs').select('id, run_at, status, details, automations!inner(name, team_id)').eq('contact_id', contactId).eq('automations.team_id', teamId),
        supabase.from('deals').select('id, created_at, name, value, pipeline_stages(name)').eq('contact_id', contactId).eq('team_id', teamId)
    ]);

    if (messagesRes.error) console.error("Error fetching timeline messages:", messagesRes.error);
    if (automationRunsRes.error) console.error("Error fetching timeline automations:", automationRunsRes.error);
    if (dealsRes.error) console.error("Error fetching timeline deals:", dealsRes.error);

    const events: TimelineEvent[] = [];

    ((messagesRes.data || []) as any[]).forEach(msg => events.push({
        id: msg.id,
        type: 'MESSAGE',
        timestamp: msg.created_at,
        data: msg
    }));

    ((automationRunsRes.data || []) as any[]).forEach(run => events.push({
        id: run.id,
        type: 'AUTOMATION_RUN',
        timestamp: run.run_at,
        data: run
    }));

    ((dealsRes.data || []) as any[]).forEach(deal => events.push({
        id: deal.id,
        type: 'DEAL_CREATED',
        timestamp: deal.created_at,
        data: deal
    }));

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const addContactToDb = async (teamId: string, contact: EditableContact): Promise<Contact> => {
    const payload: TablesInsert<'contacts'> = { ...contact, phone: normalizePhoneNumber(contact.phone), team_id: teamId };
    const { data, error } = await supabase.from('contacts').insert(payload as any).select('*').single();
    if (error) throw error;
    return data as unknown as Contact;
};

export const updateContactInDb = async (teamId: string, updatedContact: Contact): Promise<Contact> => {
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
        .eq('team_id', teamId)
        .select('*')
        .single();

    if (error) throw error;
    return data as unknown as Contact;
};

export const deleteContactFromDb = async (teamId: string, contactId: string): Promise<void> => {
    const { error } = await supabase.from('contacts').delete().eq('id', contactId).eq('team_id', teamId);
    if (error) throw error;
};

export const importContactsToDb = async (teamId: string, newContacts: EditableContact[], existingPhones: Set<string>): Promise<{ imported: Contact[]; skippedCount: number }> => {
    const contactsToInsert: TablesInsert<'contacts'>[] = [];
    let skippedCount = 0;
    
    newContacts.forEach(contact => {
        const sanitizedPhone = normalizePhoneNumber(contact.phone);
        if (sanitizedPhone && !existingPhones.has(sanitizedPhone)) {
            contactsToInsert.push({ ...contact, phone: sanitizedPhone, team_id: teamId, custom_fields: contact.custom_fields || null });
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
    
    return { imported: (data as unknown as Contact[] || []), skippedCount };
};

export const sendDirectMessagesFromApi = async (metaConfig: MetaConfig, teamId: string, message: string, recipients: Contact[]): Promise<void> => {
    const messagesToInsert: MessageInsert[] = [];
    const promises = recipients.map(contact => (async () => {
        try {
            const response = await sendTextMessage(metaConfig, contact.phone, message);
            messagesToInsert.push({
                team_id: teamId,
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
                team_id: teamId,
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