import { supabase } from '../lib/supabaseClient';
import { Profile, EditableProfile } from '../types';

export const getProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is not an error here
        console.error("Error fetching profile:", error);
        throw error;
    }
    return data as unknown as Profile | null;
};

export const updateProfileInDb = async (userId: string, profileData: EditableProfile): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .update(profileData as any)
        .eq('id', userId)
        .select('*')
        .single();
    if (error) throw error;
    return data as unknown as Profile;
};