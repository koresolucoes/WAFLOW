
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/auth-js';
import { Profile, EditableProfile, MetaConfig, Team } from '../types';
import { getProfile, updateProfileInDb } from '../services/profileService';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isInitialized: boolean;
  activeTeam: Team | null;
  userTeams: Team[];
  initializeAuth: () => () => void;
  updateProfile: (profileData: EditableProfile) => Promise<void>;
  setActiveTeam: (team: Team) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,
  activeTeam: null,
  userTeams: [],

  initializeAuth: () => {
    if (get().isInitialized) return () => {};

    const handleSession = async (session: Session | null) => {
      const user = session?.user ?? null;
      set({ session, user, activeTeam: null, userTeams: [] });

      if (user) {
        try {
            const [profileData, teamsData] = await Promise.all([
                getProfile(user.id),
                supabase.from('team_members').select('teams!inner(*)').eq('user_id', user.id)
            ]);
            
            const teams: Team[] = (teamsData.data?.map(tm => tm.teams) as Team[]) || [];
            
            set({ 
                profile: profileData,
                userTeams: teams,
                activeTeam: teams[0] || null, // Define a primeira equipa como ativa
            });
        } catch (error) {
            console.error("Failed to fetch user profile or teams", error);
            set({ profile: null, userTeams: [], activeTeam: null });
        } finally {
            set({ loading: false });
        }
      } else {
        set({ profile: null, userTeams: [], activeTeam: null, loading: false });
      }
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ loading: true, profile: null, activeTeam: null, userTeams: [] });
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

  setActiveTeam: (team: Team) => {
    set({ activeTeam: team });
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