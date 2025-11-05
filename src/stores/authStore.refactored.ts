// src/stores/authStore.refactored.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/auth-js';
import { Profile, EditableProfile } from '../types';
import { updateProfileInDb } from '../services/profileService';
import { useUiStore } from './uiStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isInitialized: boolean;
  initializeAuth: () => () => void;
  updateProfile: (profileData: EditableProfile) => Promise<void>;
  clearAuthData: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,

  initializeAuth: () => {
    if (get().isInitialized) return () => {};

    const handleSession = async (session: Session | null) => {
      const user = session?.user ?? null;
      set({ session, user });

      if (user) {
        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error("Error fetching profile:", error);
            set({ profile: null });
          } else {
            set({ profile: data });
          }
        } catch (error) {
          console.error("An unexpected error occurred while fetching the profile:", error);
          set({ profile: null });
        } finally {
          set({ loading: false });
        }
      } else {
        get().clearAuthData();
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        handleSession(null);
      } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        handleSession(session);
      }
    });

    set({ isInitialized: true });

    return () => {
      subscription?.unsubscribe();
    };
  },

  updateProfile: async (profileData) => {
    const user = get().user;
    if (!user) throw new Error("User not authenticated.");
    const { addToast } = useUiStore.getState();
    try {
      const updatedProfile = await updateProfileInDb(user.id, profileData);
      set({ profile: updatedProfile });
      addToast('Profile saved successfully!', 'success');
    } catch (error: any) {
      addToast(`Error saving profile: ${error.message}`, 'error');
      throw error;
    }
  },

  clearAuthData: () => {
    set({ session: null, user: null, profile: null, loading: false });
  },
}));
