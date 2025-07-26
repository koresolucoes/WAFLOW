
import { supabase } from '../lib/supabaseClient';
import { CustomFieldDefinition, CustomFieldDefinitionInsert } from '../types';

export const addCustomFieldDefinition = async (userId: string, definition: Omit<CustomFieldDefinitionInsert, 'user_id' | 'id' | 'created_at'>): Promise<CustomFieldDefinition> => {
    const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert({ ...definition, user_id: userId })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') { // unique_violation
            throw new Error('A chave do campo já existe. Por favor, escolha uma chave única.');
        }
        throw error;
    };
    return data;
};

export const deleteCustomFieldDefinition = async (id: string, userId: string): Promise<void> => {
    const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error) throw error;
};
