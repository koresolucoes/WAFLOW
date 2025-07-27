

import { supabase } from '../lib/supabaseClient';
import { CannedResponse, CannedResponseInsert } from '../types';
import { TablesUpdate } from '../types/database.types';

export const fetchCannedResponses = async (userId: string): Promise<CannedResponse[]> => {
    const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .eq('user_id', userId)
        .order('shortcut', { ascending: true });
    if (error) throw error;
    return data as unknown as CannedResponse[] || [];
};

export const addCannedResponse = async (userId: string, response: Omit<CannedResponseInsert, 'user_id' | 'id' | 'created_at'>): Promise<CannedResponse> => {
    const { data, error } = await supabase
        .from('canned_responses')
        .insert({ ...response, user_id: userId })
        .select()
        .single();
    if (error) throw error;
    return data as unknown as CannedResponse;
};

export const updateCannedResponse = async (id: string, updates: TablesUpdate<'canned_responses'>): Promise<CannedResponse> => {
    const { data, error } = await supabase
        .from('canned_responses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as unknown as CannedResponse;
};

export const deleteCannedResponse = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('canned_responses')
        .delete()
        .eq('id', id);
    if (error) throw error;
};
