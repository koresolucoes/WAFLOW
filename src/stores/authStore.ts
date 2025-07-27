import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/auth-js';
import { Profile, EditableProfile, MetaConfig, Team, TeamMemberWithEmail } from '../types';
import { updateProfileInDb } from '../services/profileService';
import { getTeamMembersForTeams } from '../services/teamService';
import type { RealtimeChannel } from '@supabase/realtime-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isInitialized: boolean;
  activeTeam: Team | null;
  userTeams: Team[];
  allTeamMembers: TeamMemberWithEmail[];
  teamLoading: boolean;
  teamSubscription: RealtimeChannel | null;
  initializeAuth: () => () => void;
  updateProfile: (profileData: EditableProfile) => Promise<void>;
  setActiveTeam: (team: Team) => void;
  clearTeamSubscription: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,
  activeTeam: null,
  userTeams: [],
  allTeamMembers: [],
  teamLoading: true,
  teamSubscription: null,

  clearTeamSubscription: () => {
    const { teamSubscription } = get();
    if (teamSubscription) {
        supabase.removeChannel(teamSubscription);
        set({ teamSubscription: null });
    }
  },

  initializeAuth: () => {
    if (get().isInitialized) return () => {};

    const handleSession = async (session: Session | null) => {
      get().clearTeamSubscription();

      const user = session?.user ?? null;
      set({ session, user, profile: null, activeTeam: null, userTeams: [], allTeamMembers: [] });

      if (user) {
        set({ loading: true, teamLoading: true });
        
        const { data, error } = await supabase.rpc('get_user_teams_and_profile');

        if (error) {
            console.error("Erro crítico ao buscar perfil e equipes via RPC. Verifique se a função 'get_user_teams_and_profile' existe e tem permissões (SECURITY DEFINER).", error);
            set({ loading: false, teamLoading: false });
            return;
        }

        const { profile: profileData, teams: teamsData } = data as unknown as { profile: Profile | null, teams: Team[] | null };
        let teams = (teamsData || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        let allTeamMembers: TeamMemberWithEmail[] = [];

        if (teams.length === 0) {
            console.warn(`O usuário ${user.id} não possui equipes. Acionando a criação da equipe padrão via API.`);
            try {
                const setupResponse = await fetch('/api/setup-new-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, email: user.email })
                });

                if (!setupResponse.ok) {
                    const setupError = await setupResponse.json();
                    throw new Error(`A API de configuração de equipe falhou: ${setupError.message}`);
                }

                const { data: refetchData, error: refetchError } = await supabase.rpc('get_user_teams_and_profile');
                if (refetchError) throw refetchError;

                const { teams: newTeamsData } = refetchData as unknown as { teams: Team[] | null };
                teams = (newTeamsData || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                console.log(`Equipe padrão criada e obtida com sucesso para o usuário ${user.id}.`);

            } catch (creationError) {
                console.error("Falha na lógica de fallback para criar equipe padrão:", creationError);
            }
        }

        if (teams.length > 0) {
            const teamIds = teams.map(t => t.id);
            try {
                allTeamMembers = await getTeamMembersForTeams(teamIds);
            } catch(err) {
                console.error("Não foi possível buscar os membros da equipe, a funcionalidade da equipe pode ser limitada.", err);
            }

            const channel = supabase.channel(`team-members-changes-${user.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'team_members', filter: `team_id=in.(${teamIds.join(',')})` },
                    async (payload) => {
                        console.log('Realtime change on team_members detected! Refetching members.', payload);
                        try {
                           const updatedMembers = await getTeamMembersForTeams(teamIds);
                           set({ allTeamMembers: updatedMembers });
                        } catch (err) {
                           console.error("Error refetching team members after realtime event:", err);
                        }
                    }
                )
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to team_members changes.');
                    }
                    if (err) {
                        console.error('Error subscribing to team_members changes', err);
                    }
                });
            set({ teamSubscription: channel });
        }
        
        set({ 
            profile: profileData,
            userTeams: teams,
            allTeamMembers,
            activeTeam: teams[0] || null,
            teamLoading: false,
            loading: false
        });

      } else {
        set({ profile: null, loading: false, teamLoading: false });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const currentUser = get().user;

        // When the tab is refocused, Supabase might fire SIGNED_IN or TOKEN_REFRESHED.
        // If the user is the same, we just update the session silently without triggering a full data reload.
        // This prevents the loading screen from flashing on every tab switch.
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && currentUser && session?.user?.id === currentUser.id) {
            set({ session });
            return;
        }

        // For actual sign-in (first time), sign-out, or user change events, perform the full re-initialization.
        set({ loading: true, profile: null });
        handleSession(session);
    });

    set({ isInitialized: true });

    return () => {
        subscription.unsubscribe();
        get().clearTeamSubscription();
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

useAuthStore.getState().initializeAuth();

export const useMetaConfig = (): MetaConfig => {
    return useAuthStore(state => ({
        accessToken: state.profile?.meta_access_token || '',
        wabaId: state.profile?.meta_waba_id || '',
        phoneNumberId: state.profile?.meta_phone_number_id || '',
    }));
};