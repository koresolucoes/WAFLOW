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
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && get().user && session?.user?.id === get().user?.id) {
            set({ session });
            return;
        }
        set({ loading: true, profile: null });
        handleSession(session);
    });

    set({ isInitialized: true });
    return () => {
        subscription.unsubscribe();
        get().clearSubscriptions();
    };
  },

  updateProfile: async (profileData: EditableProfile) => {
    const user = get().user;
    if (!user) throw new Error("User not authenticated.");
    const updatedProfile = await updateProfileInDb(user.id, profileData);
    set({ profile: updatedProfile });
  },

  setActiveTeam: (team: Team) => set({ activeTeam: team }),

  // Navigation
  currentPage: 'dashboard',
  pageParams: {},
  setCurrentPage: (page: Page, params: Record<string, any> = {}) => set({ currentPage: page, pageParams: params }),

  // Data Loading
  dataLoadedForTeam: null,
  fetchInitialData: async (teamId: string) => {
      if (!get().user || !teamId) return;

      const { messagesSubscription } = get();
      if (messagesSubscription) {
          supabase.removeChannel(messagesSubscription);
      }

      set({ loading: true, dataLoadedForTeam: null });
      try {
          const data = await fetchAllInitialData(teamId);
          set(state => {
              if (state.activeTeam?.id === teamId) {
                  return {
                      ...data,
                      activePipelineId: data.pipelines.length > 0 ? data.pipelines[0].id : null,
                      dataLoadedForTeam: teamId,
                      loading: false
                  };
              }
              return { loading: false };
          });
          
          const newMessagesSubscription = supabase.channel(`team-messages-${teamId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `team_id=eq.${teamId}` },
            (payload) => {
                const newMessage = inboxService.mapPayloadToUnifiedMessage(payload.new as Message);
                const { activeContactId, conversations, contacts } = get();

                if (newMessage.contact_id === activeContactId) {
                    set(state => ({ messages: [...state.messages, newMessage] }));
                }

                const convoIndex = conversations.findIndex(c => c.contact.id === newMessage.contact_id);
                if (convoIndex > -1) {
                    const updatedConvo = {
                        ...conversations[convoIndex],
                        last_message: newMessage,
                        unread_count: (newMessage.contact_id !== activeContactId && newMessage.type === 'inbound') 
                            ? (conversations[convoIndex].unread_count || 0) + 1 
                            : conversations[convoIndex].unread_count,
                    };
                    const newConversations = [
                        updatedConvo,
                        ...conversations.slice(0, convoIndex),
                        ...conversations.slice(convoIndex + 1)
                    ];
                    set({ conversations: newConversations });
                } else {
                    get().fetchConversations();
                }

                if (newMessage.type === 'inbound' && newMessage.contact_id !== activeContactId) {
                    const contact = contacts.find(c => c.id === newMessage.contact_id);
                    useUiStore.getState().addToast(`Nova mensagem de ${contact?.name || 'desconhecido'}.`, 'info');
                }
            })
            .subscribe();
          set({ messagesSubscription: newMessagesSubscription });
          
          get().fetchConversations();
          get().fetchTodaysTasks();
      } catch (err) {
          console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
          set({ loading: false });
      }
  },
  clearAllData: () => {
    const { messagesSubscription } = get();
    if (messagesSubscription) {
        supabase.removeChannel(messagesSubscription);
    }
    set({
      templates: [], contacts: [], campaigns: [], automations: [], pipelines: [], stages: [], deals: [],
      definitions: [], responses: [], messages: [], activePipelineId: null, dataLoadedForTeam: null,
      messagesSubscription: null
    });
  },

  // Templates
  templates: [],
  setTemplates: (templates) => set({ templates: typeof templates === 'function' ? templates(get().templates) : templates }),
  createTemplate: async (templateData) => {
    const { user, activeTeam, profile } = get();
    if (!user || !activeTeam || !profile) throw new Error("User, active team, or profile not available.");
    const metaConfig = { accessToken: profile.meta_access_token || '', wabaId: profile.meta_waba_id || '', phoneNumberId: profile.meta_phone_number_id || '' };
    if (!metaConfig.wabaId || !metaConfig.accessToken) throw new Error("Meta configuration is missing.");
    const newTemplate = await createTemplateOnMetaAndDb(metaConfig, templateData, activeTeam.id);
    set(state => ({ templates: [newTemplate, ...state.templates] }));
  },

  // Contacts
  contacts: [],
  allTags: [],
  contactDetails: null,
  setContacts: (contacts) => {
    const newContacts: Contact[] = typeof contacts === 'function' ? contacts(get().contacts) : contacts;
    const tagsSet = new Set<string>();
    newContacts.forEach(c => c.tags?.forEach(t => tagsSet.add(t.trim())));
    set({ contacts: newContacts, allTags: Array.from(tagsSet).sort() });
  },
  setContactDetails: (contactDetails) => set({ contactDetails: typeof contactDetails === 'function' ? contactDetails(get().contactDetails) : contactDetails }),
  addContact: async (contact) => {
      const { user, activeTeam } = get();
      if (!user || !activeTeam) throw new Error("User or active team not available.");
      const newContact = await contactService.addContactToDb(activeTeam.id, contact);
      get().setContacts(prev => [newContact, ...prev]);
      fetch('/api/run-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'contact_created', userId: user.id, contactId: newContact.id })
      }).catch(err => console.error("Failed to call contact_created trigger API", err));
  },
  updateContact: async (updatedContact) => {
      const { user, activeTeam, contactDetails, contacts } = get();
      if (!user || !activeTeam) throw new Error("User or active team not available.");
      const oldContact = (contactDetails && contactDetails.id === updatedContact.id) ? contactDetails : contacts.find(c => c.id === updatedContact.id);
      const newContact = await contactService.updateContactInDb(activeTeam.id, updatedContact);
      get().setContacts(prev => prev.map(c => c.id === newContact.id ? newContact : c));
      if (get().contactDetails?.id === newContact.id) {
          get().setContactDetails(prev => prev ? { ...prev, ...newContact } : null);
      }
      const oldTags = new Set(oldContact?.tags || []);
      const newTags = newContact.tags || [];
      const addedTags = newTags.filter(tag => !oldTags.has(tag));
      if (addedTags.length > 0) {
          fetch('/api/run-trigger', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventType: 'tags_added', userId: user.id, contactId: newContact.id, data: { addedTags } })
          }).catch(err => console.error("Failed to call tags_added trigger API", err));
      }
  },
  deleteContact: async (contactId) => {
      const { user, activeTeam } = get();
      if (!user || !activeTeam) throw new Error("User or active team not available.");
      await contactService.deleteContactFromDb(activeTeam.id, contactId);
      get().setContacts(prev => prev.filter(c => c.id !== contactId));
  },
  importContacts: async (newContacts) => {
      const { user, activeTeam, contacts } = get();
      if (!user || !activeTeam) throw new Error("User or active team not available.");
      const existingPhones = new Set<string>(contacts.map(c => contactService.normalizePhoneNumber(c.phone)));
      const { imported, skippedCount } = await contactService.importContactsToDb(activeTeam.id, newContacts, existingPhones);
      if (imported.length > 0) {
          get().setContacts(prev => [...imported, ...prev].sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
          for(const contact of imported) {
              fetch('/api/run-trigger', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ eventType: 'contact_created', userId: user.id, contactId: contact.id })
              }).catch(err => console.error("Failed to call contact_created trigger API for imported contact", err));
          }
      }
      return { importedCount: imported.length, skippedCount };
  },
  fetchContactDetails: async (contactId) => {
      const { user, activeTeam } = get();
      if (!user || !activeTeam) return;
      get().setContactDetails(null);
      const details = await contactService.fetchContactDetailsFromDb(activeTeam.id, contactId);
      get().setContactDetails(details);
  },
  sendDirectMessages: async (message, recipients) => {
      const { user, activeTeam, profile } = get();
      if (!user || !activeTeam || !profile) throw new Error("User, active team, or profile not available.");
      const metaConfig = { accessToken: profile.meta_access_token || '', wabaId: profile.meta_waba_id || '', phoneNumberId: profile.meta_phone_number_id || '' };
      if (!metaConfig.accessToken || !metaConfig.phoneNumberId) throw new Error("Meta configuration is missing.");
      await contactService.sendDirectMessagesFromApi(metaConfig, activeTeam.id, message, recipients);
  },

  // Campaigns
  campaigns: [],
  campaignDetails: null,
  setCampaigns: (campaigns) => set({ campaigns: typeof campaigns === 'function' ? campaigns(get().campaigns) : campaigns }),
  setCampaignDetails: (details) => set({ campaignDetails: typeof details === 'function' ? details(get().campaignDetails) : details }),
  addCampaign: async (campaign, messages) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const newCampaign = await addCampaignToDb(activeTeam.id, campaign, messages);
    const sentCount = messages.filter(m => m.status !== 'failed' && m.status !== 'pending').length;
    const newCampaignWithMetrics: CampaignWithMetrics = {
        ...(newCampaign as Campaign),
        metrics: { sent: sentCount, delivered: 0, read: 0, failed: messages.length - sentCount }
    };
    set(state => ({ campaigns: [newCampaignWithMetrics, ...state.campaigns] }));
  },
  fetchCampaignDetails: async (campaignId) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) return;
    const details = await fetchCampaignDetailsFromDb(activeTeam.id, campaignId);
    set({ campaignDetails: details });
  },
  deleteCampaign: async (campaignId) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    await deleteCampaignFromDb(activeTeam.id, campaignId);
    set(state => ({ campaigns: state.campaigns.filter(c => c.id !== campaignId) }));
    if (get().campaignDetails?.id === campaignId) {
        set({ campaignDetails: null });
    }
  },

  // Automations
  automations: [],
  automationStats: {},
  setAutomations: (automations) => set({ automations: typeof automations === 'function' ? automations(get().automations) : automations }),
  setAutomationStats: (stats) => set({ automationStats: typeof stats === 'function' ? stats(get().automationStats) : stats }),
  createAndNavigateToAutomation: async () => {
    const { user, activeTeam, setCurrentPage } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const newAutomation = await automationService.createAutomationInDb(activeTeam.id);
    set(state => ({ automations: [newAutomation, ...state.automations] }));
    setCurrentPage('automation-editor', { automationId: newAutomation.id });
  },
  updateAutomation: async (automation) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const updated = await automationService.updateAutomationInDb(activeTeam.id, automation);
    set(state => ({ automations: state.automations.map(a => a.id === updated.id ? updated : a) }));
  },
  deleteAutomation: async (automationId) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User not authenticated.");
    await automationService.deleteAutomationFromDb(automationId, activeTeam.id);
    set(state => ({ automations: state.automations.filter(a => a.id !== automationId) }));
  },
  fetchAutomationStats: async (automationId) => {
    if (!get().user) return;
    const statsMap = await automationService.fetchStatsForAutomation(automationId);
    set(state => ({ automationStats: {...state.automationStats, ...statsMap}}));
  },
  fetchNodeLogs: async (automationId, nodeId) => {
    if (!get().user) return [];
    return await automationService.fetchLogsForNode(automationId, nodeId);
  },

  // Funnel
  pipelines: [],
  stages: [],
  deals: [],
  activePipelineId: null,
  setPipelines: (pipelines) => set({ pipelines: typeof pipelines === 'function' ? pipelines(get().pipelines) : pipelines }),
  setStages: (stages) => set({ stages: typeof stages === 'function' ? stages(get().stages) : stages }),
  setDeals: (deals) => set({ deals: typeof deals === 'function' ? deals(get().deals) : deals }),
  setActivePipelineId: (id) => set({ activePipelineId: id }),
  addDeal: async (dealData) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const newDeal = await funnelService.addDealToDb({ ...dealData, team_id: activeTeam.id });
    set(state => ({ deals: [newDeal, ...state.deals] }));
    fetch('/api/run-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'deal_created', userId: user.id, contactId: newDeal.contact_id, data: { deal: newDeal } })
    }).catch(err => console.error("Failed to call deal_created trigger API", err));
  },
  updateDeal: async (dealId, updates) => {
    const { user, activeTeam, deals } = get();
    if (!user || !activeTeam) throw new Error("User not authenticated.");
    
    const oldDeal = deals.find(d => d.id === dealId);
    
    const updatedDeal = await funnelService.updateDealInDb(dealId, activeTeam.id, updates);
    set(state => ({ deals: state.deals.map(d => d.id === dealId ? { ...d, ...updatedDeal } : d) }));

    if (updates.stage_id && oldDeal && oldDeal.stage_id !== updates.stage_id) {
        const newStageId = updates.stage_id;
        fetch('/api/run-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                eventType: 'deal_stage_changed', 
                userId: user.id, 
                contactId: updatedDeal.contact_id, 
                data: { deal: updatedDeal, new_stage_id: newStageId }
            })
        }).catch(err => console.error("Failed to call deal_stage_changed trigger API", err));
    }
  },
  deleteDeal: async (dealId) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User not authenticated.");
    await funnelService.deleteDealFromDb(dealId, activeTeam.id);
    set(state => ({ deals: state.deals.filter(d => d.id !== dealId) }));
  },
  createDefaultPipeline: async () => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const { pipeline, stages: newStages } = await funnelService.createDefaultPipelineInDb(activeTeam.id);
    set(state => ({ pipelines: [...state.pipelines, pipeline], stages: [...state.stages, ...newStages] }));
    if (!get().activePipelineId) {
        set({ activePipelineId: pipeline.id });
    }
  },
  addPipeline: async (name) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const { pipeline, stage } = await funnelService.addPipelineToDb(activeTeam.id, name);
    set(state => ({ pipelines: [...state.pipelines, pipeline], stages: [...state.stages, stage], activePipelineId: pipeline.id }));
  },
  updatePipeline: async (id, name) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User not authenticated.");
    const updatedPipeline = await funnelService.updatePipelineInDb(id, activeTeam.id, name);
    set(state => ({ pipelines: state.pipelines.map(p => p.id === id ? updatedPipeline : p) }));
  },
  deletePipeline: async (id: string) => {
    const { user, activeTeam, pipelines } = get();
    if (!user || !activeTeam) throw new Error("User not authenticated.");
    const remainingPipelines = pipelines.filter(p => p.id !== id);
    await funnelService.deletePipelineFromDb(id, activeTeam.id);
    set(state => ({
        stages: state.stages.filter(stage => stage.pipeline_id !== id),
        deals: state.deals.filter(deal => deal.pipeline_id !== id),
        pipelines: remainingPipelines,
        activePipelineId: state.activePipelineId === id ? (remainingPipelines[0]?.id || null) : state.activePipelineId
    }));
  },
  addStage: async (pipelineId) => {
    if (!get().user) throw new Error("User not authenticated.");
    const maxSortOrder = get().stages.filter(s => s.pipeline_id === pipelineId).reduce((max, s) => Math.max(max, s.sort_order), -1);
    const newStage = await funnelService.addStageToDb(pipelineId, maxSortOrder + 1);
    set(state => ({ stages: [...state.stages, newStage] }));
  },
  updateStage: async (id, updates) => {
    if (!get().user) throw new Error("User not authenticated.");
    const updatedStage = await funnelService.updateStageInDb(id, updates);
    set(state => ({ stages: state.stages.map(s => s.id === id ? { ...s, ...updatedStage } : s) }));
  },
  deleteStage: async (id) => {
    if (!get().user) throw new Error("User not authenticated.");
    await funnelService.deleteStageFromDb(id);
    set(state => ({ stages: state.stages.filter(s => s.id !== id) }));
  },

  // Custom Fields
  definitions: [],
  setDefinitions: (definitions) => set({ definitions: typeof definitions === 'function' ? definitions(get().definitions) : definitions }),
  addDefinition: async (definition) => {
    if (!get().user || !get().activeTeam) throw new Error("User or active team not available.");
    const newDefinition = await customFieldService.addCustomFieldDefinition(get().activeTeam!.id, definition);
    set(state => ({ definitions: [...state.definitions, newDefinition].sort((a,b) => a.name.localeCompare(b.name)) }));
  },
  deleteDefinition: async (id) => {
    if (!get().user || !get().activeTeam) throw new Error("User or active team not available.");
    await customFieldService.deleteCustomFieldDefinition(id, get().activeTeam!.id);
    set(state => ({ definitions: state.definitions.filter(d => d.id !== id) }));
  },

  // Canned Responses
  responses: [],
  setResponses: (responses) => set({ responses: typeof responses === 'function' ? responses(get().responses) : responses }),
  addResponse: async (response) => {
    if (!get().user || !get().activeTeam) throw new Error("User or active team not available.");
    const newResponse = await cannedResponseService.addCannedResponse(get().activeTeam!.id, response);
    set(state => ({ responses: [...state.responses, newResponse].sort((a,b) => a.shortcut.localeCompare(b.shortcut)) }));
  },
  updateResponse: async (id, updates) => {
    if (!get().user || !get().activeTeam) throw new Error("User or active team not available.");
    const updatedResponse = await cannedResponseService.updateCannedResponse(id, get().activeTeam!.id, updates);
    set(state => ({ responses: state.responses.map(r => r.id === id ? updatedResponse : r).sort((a,b) => a.shortcut.localeCompare(b.shortcut)) }));
  },
  deleteResponse: async (id) => {
    if (!get().user || !get().activeTeam) throw new Error("User or active team not available.");
    await cannedResponseService.deleteCannedResponse(id, get().activeTeam!.id);
    set(state => ({ responses: state.responses.filter(r => r.id !== id) }));
  },

  // Inbox
  conversations: [],
  messages: [],
  activeContactId: null,
  inboxLoading: false,
  isSending: false,
  setMessages: (messages) => set({ messages: typeof messages === 'function' ? messages(get().messages) : messages }),
  setActiveContactId: (contactId) => {
    if (get().activeContactId === contactId) return;

    set({ activeContactId: contactId, messages: [], inboxLoading: !!contactId });

    if (contactId) {
        set(state => ({ 
            conversations: state.conversations.map(c => 
                c.contact.id === contactId ? { ...c, unread_count: 0 } : c
            ) 
        }));
        
        const { activeTeam } = get();
        if (activeTeam) {
            inboxService.fetchMessagesFromDb(activeTeam.id, contactId)
                .then(fetchedMessages => {
                    if (get().activeContactId === contactId) {
                        set({ messages: fetchedMessages });
                    }
                })
                .catch(error => console.error("Failed to fetch messages for contact:", error))
                .finally(() => {
                    if (get().activeContactId === contactId) {
                        set({ inboxLoading: false });
                    }
                });
        } else {
            set({ inboxLoading: false });
        }
    }
  },
  fetchConversations: async () => {
    const { user, activeTeam, allTeamMembers } = get();
    if (!user || !activeTeam) return;
    set({ inboxLoading: true });
    try {
        const data = await inboxService.fetchConversationsFromDb(activeTeam.id);
        const membersMap = new Map(allTeamMembers.map(m => [m.user_id, m.email]));
        const conversationsWithCorrectAssignee = data.map((convo): Conversation => ({
            ...convo,
            assignee_email: convo.assignee_id ? (membersMap.get(convo.assignee_id) || null) : null
        }));
        set({ conversations: conversationsWithCorrectAssignee });
    } catch (error) {
        console.error("Error fetching conversations:", error);
        set({ conversations: [] });
    } finally {
        set({ inboxLoading: false });
    }
  },
  sendMessage: async (contactId, text) => {
    const { user, activeTeam, profile, contacts } = get();
    if (!user || !activeTeam || !profile) throw new Error("User, active team, or profile not available.");
    const metaConfig = { accessToken: profile.meta_access_token || '', wabaId: profile.meta_waba_id || '', phoneNumberId: profile.meta_phone_number_id || '' };
    if (!metaConfig.accessToken) throw new Error("Meta configuration is missing.");
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) throw new Error("Contact not found.");
    
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: UnifiedMessage = {
        id: optimisticId,
        contact_id: contactId,
        content: text,
        created_at: new Date().toISOString(),
        type: 'outbound',
        status: 'pending',
        source: 'direct',
        message_template_id: null,
        replied_to_message_id: null,
    };

    set(state => ({ messages: [...state.messages, optimisticMessage] }));
    
    set({ isSending: true });
    try {
        const savedMessage = await inboxService.sendMessageToApi(activeTeam.id, contact, text, metaConfig);
        const unifiedSavedMessage = inboxService.mapPayloadToUnifiedMessage(savedMessage);
        set(state => ({ messages: state.messages.map(m => m.id === optimisticId ? unifiedSavedMessage : m) }));
    } catch (error: any) {
        console.error("Failed to send message:", error);
        set(state => ({ messages: state.messages.map(m => m.id === optimisticId ? { ...m, status: 'failed' } : m) }));
        throw error;
    } finally {
        set({ isSending: false });
    }
  },
  assignConversation: async (contactId, assigneeId) => {
    const { activeTeam, allTeamMembers, fetchConversations } = get();
    if (!activeTeam) throw new Error("No active team selected.");

    const assigneeEmail = allTeamMembers.find(m => m.user_id === assigneeId)?.email ?? null;
    set(state => ({
        conversations: state.conversations.map(c =>
            c.contact.id === contactId ? { ...c, assignee_id: assigneeId, assignee_email: assigneeEmail as string | null } : c
        )
    }));

    try {
        await inboxService.assignConversation(contactId, assigneeId);
    } catch (error) {
        console.error("Failed to assign conversation, reverting via refetch.", error);
        fetchConversations();
        throw error;
    }
  },
  deleteConversation: async (contactId) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    
    await inboxService.deleteConversation(contactId);
    
    set(state => {
        const newConversations = state.conversations.filter(c => c.contact.id !== contactId);
        let newActiveContactId = state.activeContactId;
        let newMessages = state.messages;

        if (state.activeContactId === contactId) {
            newActiveContactId = null;
            newMessages = [];
        }

        return {
            conversations: newConversations,
            activeContactId: newActiveContactId,
            messages: newMessages,
        };
    });
  },

  // Activities
  activitiesForContact: [],
  todaysTasks: [],
  activityLoading: false,
  fetchActivitiesForContact: async (contactId) => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) return;
    set({ activityLoading: true });
    try {
        const activities = await activityService.fetchActivitiesForContact(activeTeam.id, contactId);
        set({ activitiesForContact: activities });
    } catch (error) {
        console.error("Failed to fetch activities for contact:", error);
        set({ activitiesForContact: [] });
    } finally {
        set({ activityLoading: false });
    }
  },
  addActivity: async (activityData) => {
    const { user, activeTeam, activitiesForContact, fetchTodaysTasks } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const newActivity = await activityService.addActivity({ ...activityData, team_id: activeTeam.id });
    if(newActivity.contact_id === (activitiesForContact[0]?.contact_id || null)) {
        set(state => ({ activitiesForContact: [newActivity, ...state.activitiesForContact] }));
    }
    if (newActivity.type === 'TAREFA') {
        fetchTodaysTasks();
    }
    return newActivity;
  },
  updateActivity: async (activityId, updates) => {
    const { user, activeTeam, fetchTodaysTasks } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    const updatedActivity = await activityService.updateActivity(activityId, activeTeam.id, updates);
    set(state => ({ activitiesForContact: state.activitiesForContact.map(a => a.id === activityId ? { ...a, ...updates } : a) }));
    fetchTodaysTasks();
    return updatedActivity;
  },
  deleteActivity: async (activityId) => {
    const { user, activeTeam, fetchTodaysTasks } = get();
    if (!user || !activeTeam) throw new Error("User or active team not available.");
    await activityService.deleteActivity(activityId, activeTeam.id);
    set(state => ({ activitiesForContact: state.activitiesForContact.filter(a => a.id !== activityId) }));
    fetchTodaysTasks();
  },
  fetchTodaysTasks: async () => {
    const { user, activeTeam } = get();
    if (!user || !activeTeam) {
        set({ todaysTasks: [] });
        return;
    };
    try {
        const tasks = await activityService.fetchTodaysTasks(activeTeam.id);
        set({ todaysTasks: tasks });
    } catch (error) {
        console.error("Failed to fetch today's tasks:", error);
    }
  },
}));

useAuthStore.getState().initializeAuth();

export const useMetaConfig = (): MetaConfig => {
    return useAuthStore(state => ({
        accessToken: state.profile?.meta_access_token || '',
        wabaId: state.profile?.meta_waba_id || '',
        phoneNumberId: state.profile?.meta_phone_number_id || '',
    }));
};
