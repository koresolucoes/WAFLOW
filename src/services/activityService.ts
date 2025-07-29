import { supabase } from '../lib/supabaseClient';
import { ContactActivity, ContactActivityInsert, ContactActivityUpdate, TaskWithContact } from '../types';

export const fetchActivitiesForContact = async (teamId: string, contactId: string): Promise<ContactActivity[]> => {
    const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('team_id', teamId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ContactActivity[]) || [];
};

export const addActivity = async (activityData: ContactActivityInsert): Promise<ContactActivity> => {
    const { data, error } = await supabase
        .from('contact_activities')
        .insert(activityData as any)
        .select()
        .single();
    if (error) throw error;
    if (!data) throw new Error("Failed to create activity or retrieve the created record.");
    return data as ContactActivity;
};

export const updateActivity = async (activityId: string, teamId: string, updates: ContactActivityUpdate): Promise<ContactActivity> => {
    const { data, error } = await supabase
        .from('contact_activities')
        .update(updates as any)
        .eq('id', activityId)
        .eq('team_id', teamId)
        .select()
        .single();
    if (error) throw error;
    if (!data) throw new Error("Activity not found or update failed to return a record.");
    return data as ContactActivity;
};

export const deleteActivity = async (activityId: string, teamId: string): Promise<void> => {
    const { error } = await supabase
        .from('contact_activities')
        .delete()
        .eq('id', activityId)
        .eq('team_id', teamId);
    if (error) throw error;
};

export const fetchTodaysTasks = async (teamId: string): Promise<TaskWithContact[]> => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today for lte comparison

    const { data, error } = await supabase
        .from('contact_activities')
        .select('*, contacts(id, name)')
        .eq('team_id', teamId)
        .eq('type', 'TAREFA')
        .eq('is_completed', false)
        .lte('due_date', today.toISOString())
        .order('due_date', { ascending: true });
        
    if (error) {
        console.error("Error fetching today's tasks:", error);
        throw error;
    }
    
    return (data as any as TaskWithContact[]) || [];
};