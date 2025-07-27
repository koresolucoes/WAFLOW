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
  teamLoading: boolean;
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
  teamLoading: true,

  initializeAuth: () => {
    if (get().isInitialized) return () => {};

    const handleSession = async (session: Session | null) => {
      const user = session?.user ?? null;
      set({ session, user, profile: null, activeTeam: null, userTeams: [] });

      if (user) {
        set({ loading: true, teamLoading: true });
        
        // Fetch profile and teams in parallel.
        // The RLS policy on the 'teams' table will ensure only the teams the user is a member of are returned.
        // This is a cleaner and more robust way to fetch teams than joining from 'team_members', avoiding RLS issues on joins.
        const [profileData, teamsData] = await Promise.all([
            getProfile(user.id),
            supabase.from('teams').select('*').order('created_at', { ascending: true })
        ]);

        if (teamsData.error) {
            console.error("Error fetching user teams:", teamsData.error);
        }
        
        let teams = (teamsData.data as unknown as Team[]) || [];
        
        // **NOVO**: Se um utilizador autenticado não tiver equipas (por exemplo, um utilizador antigo),
        // cria uma para ele para garantir a consistência da aplicação.
        if (teams.length === 0) {
            console.warn(`O utilizador ${user.id} não tem equipas. A tentar criar uma equipa padrão.`);
            try {
                const setupResponse = await fetch('/api/setup-new-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, email: user.email })
                });

                if (!setupResponse.ok) {
                    const setupError = await setupResponse.json();
                    throw new Error(`A configuração da equipa falhou: ${setupError.message}`);
                }
                
                // Após a criação, busca novamente as equipas.
                const { data: newTeamsData, error: newTeamsError } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
                if (newTeamsError) throw newTeamsError;
                
                teams = (newTeamsData as unknown as Team[]) || [];
                console.log(`Equipa padrão criada e obtida com sucesso para o utilizador ${user.id}.`);

            } catch (creationError) {
                console.error("Falha ao criar equipa padrão para utilizador existente:", creationError);
                // Procede sem uma equipa, a UI deve lidar com este estado.
            }
        }
        
        set({ 
            profile: profileData,
            userTeams: teams,
            activeTeam: teams[0] || null,
            teamLoading: false,
            loading: false
        });

      } else {
        set({ profile: null, loading: false, teamLoading: false });
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

  setActiveTeam: (team: Team) => {
      set({ activeTeam: team });
  }
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