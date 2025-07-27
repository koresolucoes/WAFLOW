

import { supabase } from '../lib/supabaseClient';
import { ContactActivity, ContactActivityInsert, ContactActivityUpdate, TaskWithContact } from '../types';

export const fetchActivitiesForContact = async (userId: string, contactId: string): Promise<ContactActivity[]> => {
    const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('user_id', userId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data as unknown as ContactActivity[] || [];
};

export const addActivity = async (activityData: ContactActivityInsert): Promise<ContactActivity> => {
    const { data, error } = await supabase
        .from('contact_activities')
        .insert(activityData)
        .select()
        .single();
    if (error) throw error;
    return data as unknown as ContactActivity;
};

export const updateActivity = async (activityId: string, updates: ContactActivityUpdate): Promise<ContactActivity> => {
    const { data, error } = await supabase
        .from('contact_activities')
        .update(updates)
        .eq('id', activityId)
        .select()
        .single();
    if (error) throw error;
    return data as unknown as ContactActivity;
};

export const deleteActivity = async (activityId: string): Promise<void> => {
    const { error } = await supabase
        .from('contact_activities')
        .delete()
        .eq('id', activityId);
    if (error) throw error;
};

export const fetchTodaysTasks = async (userId: string): Promise<TaskWithContact[]> => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today for lte comparison

    const { data, error } = await supabase
        .from('contact_activities')
        .select('*, contacts(id, name)')
        .eq('user_id', userId)
        .eq('type', 'TAREFA')
        .eq('is_completed', false)
        .lte('due_date', today.toISOString())
        .order('due_date', { ascending: true });
        
    if (error) {
        console.error("Error fetching today's tasks:", error);
        throw error;
    }
    
    return data as unknown as TaskWithContact[] || [];
};
