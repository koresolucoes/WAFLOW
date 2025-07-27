import { supabase } from '../lib/supabaseClient';
import { CannedResponse, CannedResponseInsert } from '../types';
import { TablesUpdate } from '../types/database.types';

export const fetchCannedResponses = async (teamId: string): Promise<CannedResponse[]> => {
    const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .eq('team_id', teamId)
        .order('shortcut', { ascending: true });
    if (error) throw error;
    return data as unknown as CannedResponse[] || [];
};

export const addCannedResponse = async (teamId: string, response: Omit<CannedResponseInsert, 'team_id' | 'id' | 'created_at'>): Promise<CannedResponse> => {
    const { data, error } = await supabase
        .from('canned_responses')
        .insert({ ...response, team_id: teamId } as any)
        .select()
        .single();
    if (error) throw error;
    return data as unknown as CannedResponse;
};

export const updateCannedResponse = async (id: string, teamId: string, updates: TablesUpdate<'canned_responses'>): Promise<CannedResponse> => {
    const { data, error } = await supabase
        .from('canned_responses')
        .update(updates as any)
        .eq('id', id)
        .eq('team_id', teamId)
        .select()
        .single();
    if (error) throw error;
    return data as unknown as CannedResponse;
};

export const deleteCannedResponse = async (id: string, teamId: string): Promise<void> => {
    const { error } = await supabase
        .from('canned_responses')
        .delete()
        .eq('id', id)
        .eq('team_id', teamId);
    if (error) throw error;
};