import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/auth-js';
import { 
    Profile, EditableProfile, MetaConfig, Team, TeamMemberWithEmail, Page, MessageTemplate, MessageTemplateInsert, Contact,
    EditableContact, ContactWithDetails, Campaign, CampaignWithMetrics, MessageInsert, CampaignWithDetails, CampaignStatus,
    Automation, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, AutomationStatus, Pipeline, PipelineStage,
    DealInsert, DealWithContact, CustomFieldDefinition, CustomFieldDefinitionInsert, CannedResponse, CannedResponseInsert,
    Conversation, UnifiedMessage, Message, ContactActivity, ContactActivityInsert, ContactActivityUpdate, TaskWithContact
} from '../types';
import { updateProfileInDb } from '../services/profileService';
import * as teamService from '../services/teamService';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { createTemplateOnMetaAndDb } from '../services/templateService';
import * as contactService from '../services/contactService';
import { fetchCampaignDetailsFromDb, addCampaignToDb, deleteCampaignFromDb } from '../services/campaignService';
import * as automationService from '../services/automationService';
import * as funnelService from '../services/funnelService';
import * as customFieldService from '../services/customFieldService';
import * as cannedResponseService from '../services/cannedResponseService';
import * as inboxService from '../services/inboxService';
import * as activityService from '../services/activityService';
import { fetchAllInitialData } from '../services/dataService';
import { TablesUpdate } from '../types/database.types';
import { useUiStore } from './uiStore';

interface AuthState {
  // Auth
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
  messagesSubscription: RealtimeChannel | null;
  initializeAuth: () => () => void;
  updateProfile: (profileData: EditableProfile) => Promise<void>;
  setActiveTeam: (team: Team) => void;
  clearSubscriptions: () => void;
  
  // Navigation
  currentPage: Page;
  pageParams: Record<string, any>;
  setCurrentPage: (page: Page, params?: Record<string, any>) => void;

  // Data Loading
  dataLoadedForTeam: string | null;
  fetchInitialData: (teamId: string) => Promise<void>;
  clearAllData: () => void;

  // Templates
  templates: MessageTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  createTemplate: (templateData: Omit<MessageTemplateInsert, 'id' | 'team_id' | 'created_at' | 'status' | 'meta_id'>) => Promise<void>;

  // Contacts
  contacts: Contact[];
  allTags: string[];
  contactDetails: ContactWithDetails | null;
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setContactDetails: React.Dispatch<React.SetStateAction<ContactWithDetails | null>>;
  addContact: (contact: EditableContact) => Promise<void>;
  updateContact: (contact: Contact) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  importContacts: (newContacts: EditableContact[]) => Promise<{ importedCount: number; skippedCount: number }>;
  fetchContactDetails: (contactId: string) => Promise<void>;
  sendDirectMessages: (message: string, recipients: Contact[]) => Promise<void>;

  // Campaigns
  campaigns: CampaignWithMetrics[];
  campaignDetails: CampaignWithDetails | null;
  setCampaigns: React.Dispatch<React.SetStateAction<CampaignWithMetrics[]>>;
  setCampaignDetails: React.Dispatch<React.SetStateAction<CampaignWithDetails | null>>;
  addCampaign: (campaign: Omit<Campaign, 'id' | 'team_id' | 'created_at' | 'recipient_count'>, messages: Omit<MessageInsert, 'campaign_id' | 'team_id'>[]) => Promise<void>;
  fetchCampaignDetails: (campaignId: string) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;

  // Automations
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  automationStats: Record<string, AutomationNodeStats>;
  setAutomationStats: React.Dispatch<React.SetStateAction<Record<string, AutomationNodeStats>>>;
  createAndNavigateToAutomation: () => Promise<void>;
  updateAutomation: (automation: Automation) => Promise<void>;
  deleteAutomation: (automationId: string) => Promise<void>;
  fetchAutomationStats: (automationId: string) => Promise<void>;
  fetchNodeLogs: (automationId: string, nodeId: string) => Promise<AutomationNodeLog[]>;
  
  // Funnel
  pipelines: Pipeline[];
  stages: PipelineStage[];
  deals: DealWithContact[];
  activePipelineId: string | null;
  setPipelines: React.Dispatch<React.SetStateAction<Pipeline[]>>;
  setStages: React.Dispatch<React.SetStateAction<PipelineStage[]>>;
  setDeals: React.Dispatch<React.SetStateAction<DealWithContact[]>>;
  setActivePipelineId: (id: string | null) => void;
  addDeal: (dealData: Omit<DealInsert, 'team_id'>) => Promise<void>;
  updateDeal: (dealId: string, updates: TablesUpdate<'deals'>) => Promise<void>;
  deleteDeal: (dealId: string) => Promise<void>;
  createDefaultPipeline: () => Promise<void>;
  addPipeline: (name: string) => Promise<void>;
  updatePipeline: (id: string, name: string) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  addStage: (pipelineId: string) => Promise<void>;
  updateStage: (id: string, updates: TablesUpdate<'pipeline_stages'>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;

  // Custom Fields
  definitions: CustomFieldDefinition[];
  setDefinitions: React.Dispatch<React.SetStateAction<CustomFieldDefinition[]>>;
  addDefinition: (definition: Omit<CustomFieldDefinitionInsert, 'team_id' | 'id' | 'created_at'>) => Promise<void>;
  deleteDefinition: (id: string) => Promise<void>;

  // Canned Responses
  responses: CannedResponse[];
  setResponses: React.Dispatch<React.SetStateAction<CannedResponse[]>>;
  addResponse: (response: Omit<CannedResponseInsert, 'team_id' | 'id' | 'created_at'>) => Promise<void>;
  updateResponse: (id: string, updates: TablesUpdate<'canned_responses'>) => Promise<void>;
  deleteResponse: (id: string) => Promise<void>;

  // Inbox
  conversations: Conversation[];
  messages: UnifiedMessage[];
  activeContactId: string | null;
  setActiveContactId: (contactId: string | null) => void;
  sendMessage: (contactId: string, text: string) => Promise<void>;
  assignConversation: (contactId: string, assigneeId: string | null) => Promise<void>;
  deleteConversation: (contactId: string) => Promise<void>;
  inboxLoading: boolean;
  isSending: boolean;
  fetchConversations: () => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<UnifiedMessage[]>>;

  // Activities
  activitiesForContact: ContactActivity[];
  todaysTasks: TaskWithContact[];
  activityLoading: boolean;
  fetchActivitiesForContact: (contactId: string) => Promise<void>;
  addActivity: (activityData: Omit<ContactActivityInsert, 'team_id'>) => Promise<ContactActivity | null>;
  updateActivity: (activityId: string, updates: ContactActivityUpdate) => Promise<ContactActivity | null>;
  deleteActivity: (activityId: string) => Promise<void>;
  fetchTodaysTasks: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Auth
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
  messagesSubscription: null,
  
  clearSubscriptions: () => {
    const { teamSubscription, messagesSubscription } = get();
    if (teamSubscription) {
        supabase.removeChannel(teamSubscription);
    }
    if (messagesSubscription) {
        supabase.removeChannel(messagesSubscription);
    }
    set({ teamSubscription: null, messagesSubscription: null });
  },

  initializeAuth: () => {
    if (get().isInitialized) return () => {};

    const handleSession = async (session: Session | null) => {
      get().clearSubscriptions();
      const user = session?.user ?? null;
      set({ session, user, profile: null, activeTeam: null, userTeams: [], allTeamMembers: [] });

      if (user) {
        set({ loading: true, teamLoading: true });
        
        const { data, error } = await supabase.rpc('get_user_teams_and_profile');

        if (error) {
            console.error("Erro crítico ao buscar perfil e equipes via RPC.", error);
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

                if (!setupResponse.ok) throw new Error(await setupResponse.text());

                const { data: refetchData, error: refetchError } = await supabase.rpc('get_user_teams_and_profile');
                if (refetchError) throw refetchError;

                const { teams: newTeamsData } = refetchData as unknown as { teams: Team[] | null };
                teams = (newTeamsData || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            } catch (creationError) {
                console.error("Falha na lógica de fallback para criar equipe padrão:", creationError);
            }
        }

        if (teams.length > 0) {
            const teamIds = teams.map(t => t.id);
            try {
                allTeamMembers = await teamService.getTeamMembersForTeams(teamIds);
            } catch(err) {
                console.error("Não foi possível buscar os membros da equipe.", err);
            }

            const channel = supabase.channel(`team-members-changes-${user.id}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'team_members', filter: `team_id=in.(${teamIds.join(',')})` },
                    async () => {
                        const updatedMembers = await teamService.getTeamMembersForTeams(teamIds);
                        set({ allTeamMembers: updatedMembers });
                    }
                ).subscribe();
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

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REF