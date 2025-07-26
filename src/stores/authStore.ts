import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { Profile, EditableProfile, MetaConfig } from '../types';
import { getProfile, updateProfileInDb } from '../services/profileService';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isInitialized: boolean;
  initializeAuth: () => () => void;
  updateProfile: (profileData: EditableProfile) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,

  initializeAuth: () => {
    if (get().isInitialized) return () => {};

    const handleSession = (session: Session | null) => {
      const user = session?.user ?? null;
      set({ session, user });
      if (user) {
        getProfile(user.id).then(profileData => {
          set({ profile: profileData, loading: false });
        });
      } else {
        set({ profile: null, loading: false });
      }
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ loading: true, profile: null });
        handleSession(session);
    });

    set({ isInitialized: true });

    return () => {
        subscription.unsubscribe();
    };
  },

  updateProfile: async (profileData: EditableProfile) => {
    const user = get().user;
    if (!user) throw new Error("User not authenticated.");
    const updatedProfile = await updateProfileInDb(user.id, profileData);
    set({ profile: updatedProfile });
  },
}));

// Initialize the listener as soon as the store is imported.
useAuthStore.getState().initializeAuth();

// Selector for derived state like metaConfig
export const useMetaConfig = (): MetaConfig => {
    return useAuthStore(state => ({
        accessToken: state.profile?.meta_access_token || '',
        wabaId: state.profile?.meta_waba_id || '',
        phoneNumberId: state.profile?.meta_phone_number_id || '',
    }));
};