
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Session, User, Profile, EditableProfile } from '../../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  updateProfile: (profileData: EditableProfile) => Promise<void>;
  metaConfig: {
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
  };
}

export const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // Set initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error("Error fetching profile, user might not have one yet.", error);
        } else if (data) {
          setProfile(data as unknown as Profile);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  const updateProfile = useCallback(async (profileData: EditableProfile) => {
    if (!user) throw new Error("User not authenticated.");
    const { data, error } = await supabase.from('profiles').update(profileData as any).eq('id', user.id).select().single();
    if (error) throw error;
    if (data) setProfile(data as unknown as Profile);
  }, [user]);

  const metaConfig = useMemo(() => ({
    accessToken: profile?.meta_access_token || '',
    wabaId: profile?.meta_waba_id || '',
    phoneNumberId: profile?.meta_phone_number_id || '',
  }), [profile]);
  
  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    updateProfile,
    metaConfig,
  };

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
};