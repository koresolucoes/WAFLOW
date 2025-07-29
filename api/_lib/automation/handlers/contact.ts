import { supabaseAdmin } from '../../supabaseAdmin.js';
import { Contact } from '../../types.js';
import { handleTagAddedEvent } from '../trigger-handler.js';
import { ActionHandler } from '../types.js';
import { resolveVariables } from '../helpers.js';

export const addTag: ActionHandler = async ({ profile, contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Adicionar Tag" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (config.tag) {
        const tagToAdd = resolveVariables(config.tag, { contact, trigger });

        if (contact.tags?.includes(tagToAdd)) {
            return { updatedContact: contact, details: `Contato já possui a tag '${tagToAdd}'. Nenhuma ação executada.` };
        }

        const newTags = Array.from(new Set([...(contact.tags || []), tagToAdd]));
        const updatePayload: any = { tags: newTags };
        const { data: updatedContact, error } = await supabaseAdmin
            .from('contacts')
            .update(updatePayload as any)
            .eq('id', contact.id)
            .select('*')
            .single();

        if (error) throw error;
        if (!updatedContact) throw new Error('Failed to update contact after adding tag.');
        const finalContact = updatedContact as unknown as Contact;

        handleTagAddedEvent(profile.id, finalContact, tagToAdd);
        
        return { updatedContact: finalContact, details: `Tag '${tagToAdd}' adicionada ao contato.` };
    }
     throw new Error('Tag a ser adicionada não está configurada.');
};

export const removeTag: ActionHandler = async ({ contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Remover Tag" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if (config.tag) {
        const tagToRemove = resolveVariables(config.tag, { contact, trigger });
        const newTags = (contact.tags || []).filter(t => t !== tagToRemove);
        const updatePayload: any = { tags: newTags };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload as any).eq('id', contact.id).select('*').single();
        if (error) throw error;
        if (!data) throw new Error('Failed to update contact after removing tag.');
        return { updatedContact: data as unknown as Contact, details: `Tag '${tagToRemove}' removida do contato.` };
    }
    throw new Error('Tag a ser removida não está configurada.');
};

export const setCustomField: ActionHandler = async ({ contact, node, trigger }) => {
    if (!contact) {
        throw new Error('Ação "Definir Campo Personalizado" requer um contato.');
    }
    const config = (node.data.config || {}) as any;
    if(config.field_name){
        const fieldName = resolveVariables(config.field_name, { contact, trigger }).replace(/\s+/g, '_');
        const fieldValue = resolveVariables(config.field_value || '', { contact, trigger });
        const newCustomFields = { ...(contact.custom_fields as object || {}), [fieldName]: fieldValue };
        const updatePayload: any = { custom_fields: newCustomFields };
        const { data, error } = await supabaseAdmin.from('contacts').update(updatePayload as any).eq('id', contact.id).select('*').single();
        if (error) throw error;
        if (!data) throw new Error('Failed to update contact after setting custom field.');
        return { updatedContact: data as unknown as Contact, details: `Campo '${fieldName}' atualizado para '${fieldValue}'.` };
    }
    throw new Error('Nome do campo personalizado não está configurado.');
};