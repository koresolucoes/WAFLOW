

import React, { createContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Page, Profile, MessageTemplate, Contact, Campaign, CampaignWithMetrics, EditableContact, Session, User, CampaignMessageInsert, CampaignWithDetails, CampaignMessageWithContact, Segment, MessageTemplateInsert, Automation, AutomationInsert, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, CampaignStatus, MessageStatus, Pipeline, PipelineStage, Deal, DealInsert, ContactWithDetails, DealWithContact, AutomationStatus, EditableProfile, CampaignMessage, TemplateCategory, TemplateStatus } from '../types';
import { Json, Tables, TablesInsert, TablesUpdate } from '../types/database.types';
import { MetaTemplateComponent } from '../services/meta/types';

interface AppContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  currentPage: Page;
  setCurrentPage: (page: Page, params?: Record<string, any>) => void;
  pageParams: Record<string, any>;
  
  metaConfig: {
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
  };
  updateProfile: (profileData: EditableProfile) => Promise<void>;

  templates: MessageTemplate[];
  addTemplate: (template: MessageTemplateInsert) => Promise<void>;
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;

  contacts: Contact[];
  addContact: (contact: EditableContact) => Promise<void>;
  updateContact: (contact: Contact) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  importContacts: (newContacts: EditableContact[]) => Promise<{ importedCount: number; skippedCount: number }>;
  contactDetails: ContactWithDetails | null;
  fetchContactDetails: (contactId: string) => Promise<void>;


  campaigns: CampaignWithMetrics[];
  addCampaign: (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & { status: CampaignStatus }, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => Promise<void>;
  
  campaignDetails: CampaignWithDetails | null;
  fetchCampaignDetails: (campaignId: string) => Promise<void>;

  segments: Segment[];
  
  automations: Automation[];
  createAndNavigateToAutomation: () => Promise<void>;
  updateAutomation: (automation: Automation) => Promise<void>;
  deleteAutomation: (automationId: string) => Promise<void>;

  automationStats: Record<string, AutomationNodeStats>;
  fetchAutomationStats: (automationId: string) => Promise<void>;
  fetchNodeLogs: (automationId: string, nodeId: string) => Promise<AutomationNodeLog[]>;
  setAutomationStats: React.Dispatch<React.SetStateAction<Record<string, AutomationNodeStats>>>;
  
  pipelines: Pipeline[];
  stages: PipelineStage[];
  deals: DealWithContact[];
  addDeal: (dealData: DealInsert) => Promise<void>;
  updateDealStage: (dealId: string, newStageId: string) => Promise<void>;
  createDefaultPipeline: () => Promise<void>;
  
  activePipelineId: string | null;
  setActivePipelineId: (id: string | null) => void;
  addPipeline: (name: string) => Promise<void>;
  updatePipeline: (id: string, name: string) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;
  addStage: (pipelineId: string) => Promise<void>;
  updateStage: (id: string, name: string) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
}

export const AppContext = createContext<AppContextType>(null!);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  const [currentPage, setCurrentPageInternal] = useState<Page>('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, any>>({});
  
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactDetails, setContactDetails] = useState<ContactWithDetails | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [campaignDetails, setCampaignDetails] = useState<CampaignWithDetails | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationStats, setAutomationStats] = useState<Record<string, AutomationNodeStats>>({});
  
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);


  useEffect(() => {
    // This effect manages the user's authentication state.
    // It runs only once on mount to set up the listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        // Use a functional update for setUser to safely access the previous state
        // without adding 'user' to the dependency array, which would cause a loop.
        setUser(currentUser => {
            const newUser = session?.user ?? null;
            // If the user ID is different (login/logout), reset all app data.
            if (currentUser?.id !== newUser?.id) {
                setProfile(null);
                setTemplates([]);
                setContacts([]);
                setContactDetails(null);
                setCampaigns([]);
                setCampaignDetails(null);
                setSegments([]);
                setAutomations([]);
                setAutomationStats({});
                setPipelines([]);
                setStages([]);
                setDeals([]);
                setActivePipelineId(null);
                setInitialDataLoaded(false); // Mark that data needs to be fetched for the new user.
            }
            return newUser;
        });

        setSession(session);
        setLoading(false); // Auth state is resolved, no longer loading.
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once.


  const fetchCampaignsWithMetrics = useCallback(async (campaignsData: Campaign[]) => {
    const campaignsWithMetrics: CampaignWithMetrics[] = await Promise.all(
        campaignsData.map(async (campaign) => {
            const { data, error, count } = await supabase
                .from('campaign_messages')
                .select('status', { count: 'exact', head: false })
                .eq('campaign_id', campaign.id);

            if (error) {
                console.error(`Error fetching metrics for campaign ${campaign.id}:`, error);
                return { ...campaign, recipient_count: campaign.recipient_count || 0, metrics: { sent: campaign.recipient_count || 0, delivered: 0, read: 0 } };
            }
            
            const typedData = (data as Pick<CampaignMessage, 'status'>[]) || [];
            const delivered = typedData.filter(d => d.status === 'delivered' || d.status === 'read').length;
            const read = typedData.filter(d => d.status === 'read').length;

            return {
                ...campaign,
                recipient_count: campaign.recipient_count || 0,
                metrics: { sent: count || campaign.recipient_count || 0, delivered, read }
            };
        })
    );
    setCampaigns(campaignsWithMetrics);
  }, []);
  
  const fetchInitialData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      
      try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error("Error fetching profile, user might not have one yet. Relying on DB trigger.", profileError);
          } else if (profileData) {
            setProfile(profileData as Profile);
          }

          const [templatesRes, contactsRes, campaignsRes, segmentsRes, automationsRes, pipelinesRes, stagesRes, dealsRes] = await Promise.all([
              supabase.from('message_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('contacts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('campaigns').select('*').eq('user_id', user.id).order('sent_at', { ascending: false }),
              supabase.from('segments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('automations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('pipelines').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
              supabase.from('pipeline_stages').select('*, pipelines!inner(user_id)').eq('pipelines.user_id', user.id),
              supabase.from('deals').select('*, contacts(id, name)').eq('user_id', user.id).order('created_at', { ascending: false }),
          ]);

          if (templatesRes.error) console.error("Error fetching templates:", templatesRes.error);
          else if (templatesRes.data) {
             setTemplates((templatesRes.data as Tables<'message_templates'>[]).map(t => ({
                ...t,
                category: t.category as TemplateCategory,
                status: t.status as TemplateStatus,
                components: (t.components as unknown as MetaTemplateComponent[]) || [],
            })));
          }

          if (contactsRes.error) console.error("Error fetching contacts:", contactsRes.error);
          else if (contactsRes.data) setContacts(contactsRes.data as Contact[]);

          if (campaignsRes.error) {
            console.error("Error fetching campaigns:", campaignsRes.error);
          } else if (campaignsRes.data) {
            await fetchCampaignsWithMetrics(campaignsRes.data as Campaign[]);
          }
          
          if (segmentsRes.error) console.error("Error fetching segments:", segmentsRes.error);
          else if (segmentsRes.data) setSegments(segmentsRes.data as Segment[]);
          
          if (automationsRes.error) {
            console.error("Error fetching automations:", automationsRes.error);
          } else if (automationsRes.data){
            const automationsData = automationsRes.data as Tables<'automations'>[];
            const sanitizedAutomations: Automation[] = automationsData.map(a => ({
              ...a,
              nodes: (Array.isArray(a.nodes) ? a.nodes : []) as unknown as AutomationNode[],
              edges: (Array.isArray(a.edges) ? a.edges : []) as unknown as Edge[],
              status: a.status as AutomationStatus,
            }));
            setAutomations(sanitizedAutomations);
          }
          
          if (pipelinesRes.error) {
            console.error("Error fetching pipelines:", pipelinesRes.error);
          } else if (pipelinesRes.data) {
            const typedPipelines = pipelinesRes.data as Pipeline[];
            setPipelines(typedPipelines);
            if (typedPipelines.length > 0 && !activePipelineId) {
                setActivePipelineId(typedPipelines[0].id);
            }
          }
          
          if (stagesRes.error) {
              console.error("Error fetching stages:", stagesRes.error);
          } else if (stagesRes.data) {
              setStages(stagesRes.data as PipelineStage[]);
          }
          
          if (dealsRes.error) console.error("Error fetching deals:", dealsRes.error);
          else if (dealsRes.data) setDeals(dealsRes.data as DealWithContact[]);

      } catch (err) {
        console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
      } finally {
        setLoading(false);
      }
  }, [user, activePipelineId, fetchCampaignsWithMetrics]);

  useEffect(() => {
    if (user && session && !initialDataLoaded) {
        setInitialDataLoaded(true);
        fetchInitialData();
    }
  }, [user, session, initialDataLoaded, fetchInitialData]);

  const fetchCampaignDetails = useCallback(async (campaignId: string) => {
    if (!user) return;
    setCampaignDetails(null);

    try {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, message_templates(*)')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single();
        
      if (campaignError || !campaignData) {
        throw campaignError || new Error("Campanha não encontrada ou acesso negado.");
      }
      
      const { data: messagesData, error: messagesError } = await supabase
        .from('campaign_messages')
        .select('*, contacts(name, phone)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
        
      if (messagesError) throw messagesError;

      const typedMessagesData = (messagesData as CampaignMessageWithContact[]) || [];
      const delivered = typedMessagesData.filter(d => d.status === 'delivered' || d.status === 'read').length;
      const read = typedMessagesData.filter(d => d.status === 'read').length;
      
      const campaignDataTyped = campaignData as any;
      const message_template_data = campaignDataTyped.message_templates;


      setCampaignDetails({
        ...(campaignDataTyped as Campaign),
        messages: typedMessagesData,
        status: campaignDataTyped.status as CampaignStatus,
        message_templates: message_template_data ? {
            ...message_template_data,
            category: message_template_data.category as TemplateCategory,
            status: message_template_data.status as TemplateStatus,
            components: (message_template_data.components as unknown as MetaTemplateComponent[]) || []
        } : null,
        metrics: {
          sent: campaignDataTyped.recipient_count || 0,
          delivered,
          read
        }
      });

    } catch (err) {
      console.error("Error fetching campaign details:", (err as any).message || err);
      throw err;
    }
  }, [user]);
  
  const fetchContactDetails = useCallback(async (contactId: string) => {
    if (!user) return;
    setContactDetails(null);
    try {
        const { data: contactData, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .eq('user_id', user.id)
            .single();

        if (contactError || !contactData) {
            throw contactError || new Error("Contato não encontrado ou acesso negado.");
        }

        const { data: dealsData, error: dealsError } = await supabase
            .from('deals')
            .select('*')
            .eq('contact_id', contactId);
        
        if (dealsError) throw dealsError;
        
        setContactDetails({
            ...(contactData as Contact),
            deals: (dealsData as Deal[]) || []
        });

    } catch (err) {
        console.error("Error fetching contact details:", (err as any).message || err);
        throw err;
    }
  }, [user]);


  const setCurrentPage = useCallback((page: Page, params: Record<string, any> = {}) => {
    setCurrentPageInternal(page);
    setPageParams(params);
  }, []);

  const updateProfile = useCallback(async (profileData: EditableProfile) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('profiles').update(profileData as any).eq('id', user.id).select().single();
    if(error) throw error;
    if (data) setProfile(data as Profile);
  }, [user]);
  
  const metaConfig = useMemo(() => ({
    accessToken: profile?.meta_access_token || '',
    wabaId: profile?.meta_waba_id || '',
    phoneNumberId: profile?.meta_phone_number_id || '',
  }), [profile]);


  const addTemplate = useCallback(async (template: MessageTemplateInsert) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const dbTemplate: TablesInsert<'message_templates'> = {
        ...template,
        components: template.components as unknown as Json,
    };
    
    const { data, error } = await supabase
      .from('message_templates')
      .insert(dbTemplate as any)
      .select()
      .single();
    if (error) throw error;
    if (data) {
        const dataTyped = data as Tables<'message_templates'>;
        const newTemplate: MessageTemplate = {
            ...dataTyped,
            category: dataTyped.category as TemplateCategory,
            status: dataTyped.status as TemplateStatus,
            components: (dataTyped.components as unknown as MetaTemplateComponent[]) || []
        };
        setTemplates(prev => [newTemplate, ...prev]);
    }
  }, [user]);
  
  const checkAndRunContactAutomations = useCallback(async (contact: Contact, previousContactState?: Contact) => {
    if (!user) return;
    if (!previousContactState) {
        fetch('/api/run-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triggerType: 'new_contact', userId: user.id, contactId: contact.id })
        }).catch(err => console.error("Failed to call new_contact trigger API", err));
        
        const initialTags = contact.tags || [];
        for (const tag of initialTags) {
             fetch('/api/run-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggerType: 'new_contact_with_tag', userId: user.id, contactId: contact.id, data: { addedTag: tag } })
            }).catch(err => console.error("Failed to call new_contact_with_tag trigger API", err));
        }
        return;
    }
    const oldTags = new Set(previousContactState?.tags || []);
    const newTags = contact.tags || [];
    for (const tag of newTags) {
        if (!oldTags.has(tag)) {
            fetch('/api/run-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggerType: 'new_contact_with_tag', userId: user.id, contactId: contact.id, data: { addedTag: tag } })
            }).catch(err => console.error("Failed to call new_contact_with_tag trigger API", err));
        }
    }
  }, [user]);


  const addContact = useCallback(async (contact: EditableContact) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const payload: TablesInsert<'contacts'> = { ...contact, user_id: user.id };
    const { data, error } = await supabase.from('contacts').insert(payload as any).select().single();
    if (error) throw error;
    if(data) {
      const newContact = data as Contact;
      setContacts(prev => [newContact, ...prev]);
      await checkAndRunContactAutomations(newContact);
    }
  }, [user, checkAndRunContactAutomations]);
  
  const updateContact = useCallback(async (updatedContact: Contact) => {
     if (!user) throw new Error("Usuário não autenticado.");
     const oldContact = contacts.find(c => c.id === updatedContact.id);
     const { id, created_at, user_id, ...updatePayload } = updatedContact;
     const { data, error } = await supabase.from('contacts').update(updatePayload as any).eq('id', updatedContact.id).eq('user_id', user.id).select().single();
    if (error) throw error;
    if(data) {
      const newContact = data as Contact;
      setContacts(prev => prev.map(c => c.id === newContact.id ? newContact : c));
      if(contactDetails?.id === newContact.id) {
          setContactDetails(prev => prev ? {...prev, ...newContact} : null)
      }
      await checkAndRunContactAutomations(newContact, oldContact);
    }
  }, [user, contacts, contactDetails, checkAndRunContactAutomations]);

  const deleteContact = useCallback(async (contactId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase.from('contacts').delete().eq('id', contactId).eq('user_id', user.id);
    if (error) throw error;
    setContacts(prev => prev.filter(c => c.id !== contactId));
  }, [user]);
  
  const importContacts = useCallback(async (newContacts: EditableContact[]): Promise<{ importedCount: number; skippedCount: number }> => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const existingPhones = new Set(contacts.map(c => c.phone.replace(/\D/g, '')));
    const contactsToInsert: TablesInsert<'contacts'>[] = [];
    let skippedCount = 0;
    
    newContacts.forEach(contact => {
        const sanitizedPhone = contact.phone.replace(/\D/g, '');
        if (sanitizedPhone && !existingPhones.has(sanitizedPhone)) {
            contactsToInsert.push({ ...contact, user_id: user.id, custom_fields: contact.custom_fields || null });
            existingPhones.add(sanitizedPhone);
        } else {
            skippedCount++;
        }
    });

    if (contactsToInsert.length > 0) {
        const { data, error } = await supabase.from('contacts').insert(contactsToInsert as any).select();
        if (error) throw error;
        if(data) {
          const newContactList = data as Contact[];
          setContacts(prev => [...newContactList, ...prev].sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
          for(const contact of newContactList) {
              await checkAndRunContactAutomations(contact);
          }
        }
    }
    return { importedCount: contactsToInsert.length, skippedCount };
  }, [user, contacts, checkAndRunContactAutomations]);

  const addCampaign = useCallback(async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & {status: CampaignStatus}, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const sent_at = new Date().toISOString();
    const campaignPayload: TablesInsert<'campaigns'> = { ...campaign, user_id: user.id, sent_at, recipient_count: messages.length, status: campaign.status };
    const { data: newCampaignData, error: campaignError } = await supabase.from('campaigns').insert(campaignPayload as any).select().single();

    if (campaignError) throw campaignError;
    const newCampaign = newCampaignData as Tables<'campaigns'>;
    if (!newCampaign) throw new Error("Failed to create campaign.");

    const messagesToInsert = messages.map(msg => ({ ...msg, campaign_id: newCampaign.id }));
    const { error: messagesError } = await supabase.from('campaign_messages').insert(messagesToInsert as any);

    if (messagesError) {
        await supabase.from('campaigns').delete().eq('id', newCampaign.id);
        throw messagesError;
    }
    
    const sentCount = messages.filter(m => m.status !== 'failed').length;

    const newCampaignWithMetrics: CampaignWithMetrics = {
        ...(newCampaign as Campaign),
        metrics: { sent: sentCount, delivered: 0, read: 0 }
    };
    setCampaigns(prev => [newCampaignWithMetrics, ...prev]);
  }, [user]);
  
  const addDeal = useCallback(async (dealData: DealInsert) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('deals').insert(dealData as any).select('*, contacts(id, name)').single();
    if(error) throw error;
    if (data) {
        setDeals(prev => [data as DealWithContact, ...prev]);
    }
  }, [user]);

  const updateDealStage = useCallback(async (dealId: string, newStageId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('deals').update({ stage_id: newStageId } as any).eq('id', dealId).select('*, contacts(id, name)').single();
    if(error) throw error;
    if (data) {
        setDeals(prev => prev.map(d => d.id === dealId ? (data as DealWithContact) : d));
    }
  }, [user]);

  const createAndNavigateToAutomation = useCallback(async () => {
    if (!user) throw new Error("Usuário não autenticado.");

    const dbAutomation: TablesInsert<'automations'> = { user_id: user.id, name: 'Nova Automação (Rascunho)', status: 'paused', nodes: [] as unknown as Json, edges: [] as unknown as Json };
    const { data, error } = await supabase.from('automations').insert(dbAutomation as any).select().single();

    if (error) throw error;
    if (data) {
        const dataTyped = data as Tables<'automations'>;
        const newAutomation: Automation = { ...dataTyped, nodes: [], edges: [], status: dataTyped.status as AutomationStatus };
        setAutomations(prev => [newAutomation, ...prev]);
        setCurrentPage('automation-editor', { automationId: newAutomation.id });
    }
  }, [user, setCurrentPage]);

  const updateAutomation = useCallback(async (automation: Automation) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const updatePayload: TablesUpdate<'automations'> = { name: automation.name, status: automation.status, nodes: automation.nodes as unknown as Json, edges: automation.edges as unknown as Json };
    const { data, error } = await supabase.from('automations').update(updatePayload as any).eq('id', automation.id).eq('user_id', user.id).select().single();
    if(error) throw error;
    if(data) {
      const updatedAutomationData = data as Tables<'automations'>;
      const updatedAutomation: Automation = { ...updatedAutomationData, nodes: (Array.isArray(updatedAutomationData.nodes) ? updatedAutomationData.nodes : []) as unknown as AutomationNode[], edges: (Array.isArray(updatedAutomationData.edges) ? updatedAutomationData.edges : []) as unknown as Edge[], status: updatedAutomationData.status as AutomationStatus };
      setAutomations(prev => prev.map(a => a.id === updatedAutomation.id ? updatedAutomation : a));
    }
  }, [user]);
  
  const deleteAutomation = useCallback(async (automationId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase.from('automations').delete().eq('id', automationId);
    if (error) throw error;
    setAutomations(prev => prev.filter(a => a.id !== automationId));
  }, [user]);
  
  const fetchAutomationStats = useCallback(async (automationId: string) => {
    if (!user) return;
    const { data, error } = await supabase.from('automation_node_stats').select('*').eq('automation_id', automationId);
    if (error) { console.error("Error fetching automation stats:", error); return; }
    if (data) {
        const statsMap = (data as AutomationNodeStats[]).reduce((acc, stat) => { acc[stat.node_id] = stat; return acc; }, {} as Record<string, AutomationNodeStats>);
        setAutomationStats(prev => ({...prev, ...statsMap}));
    }
  }, [user]);

  const fetchNodeLogs = useCallback(async (automationId: string, nodeId: string): Promise<AutomationNodeLog[]> => {
    if (!user) return [];
    
    const { data: runIdsData, error: runIdsError } = await supabase.from('automation_runs').select('id').eq('automation_id', automationId);
    if (runIdsError || !runIdsData) { console.error('Error fetching run IDs for logs:', runIdsError); return []; }
    const runIds = (runIdsData as { id: string }[]).map(r => r.id);
    if (runIds.length === 0) return [];
    const { data, error } = await supabase.from('automation_node_logs').select('*').in('run_id', runIds).eq('node_id', nodeId).order('created_at', { ascending: false }).limit(100);
    if (error) { console.error("Error fetching node logs:", error); return []; }
    return (data as AutomationNodeLog[]) || [];
  }, [user]);

  const createDefaultPipeline = useCallback(async () => {
    if (!user) throw new Error("Usuário não autenticado.");

    const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!existingProfile) {
        const { data: newProfile, error: createProfileError } = await supabase.from('profiles').insert({ id: user.id, company_name: 'Minha Empresa', webhook_path_prefix: `user-${Math.random().toString(36).substring(2, 8)}` } as any).select().single();
        if (createProfileError || !newProfile) throw createProfileError || new Error("Falha ao criar perfil.");
        setProfile(newProfile as Profile);
    }
    
    const { data: pipelineData, error: pipelineError } = await supabase.from('pipelines').insert({ user_id: user.id, name: 'Funil de Vendas Padrão' } as any).select().single();
    if (pipelineError || !pipelineData) throw pipelineError || new Error("Falha ao criar funil.");
    
    const pipelineDataTyped = pipelineData as any;
    const defaultStages = [ { name: 'Novo Lead', sort_order: 0 }, { name: 'Contato Feito', sort_order: 1 }, { name: 'Proposta Enviada', sort_order: 2 }, { name: 'Negociação', sort_order: 3 }, { name: 'Ganhos', sort_order: 4 }, { name: 'Perdidos', sort_order: 5 } ];
    const stagesToInsert: TablesInsert<'pipeline_stages'>[] = defaultStages.map(stage => ({ ...stage, pipeline_id: pipelineDataTyped.id }));
    const { data: stagesData, error: stagesError } = await supabase.from('pipeline_stages').insert(stagesToInsert as any).select();

    if (stagesError || !stagesData) {
        await supabase.from('pipelines').delete().eq('id', pipelineDataTyped.id);
        throw stagesError || new Error("Falha ao criar etapas.");
    }
    
    setPipelines(prev => [...prev, pipelineDataTyped as Pipeline]);
    setStages(prev => [...prev, ...(stagesData as PipelineStage[])]);
    setActivePipelineId(pipelineDataTyped.id);
  }, [user]);

  const addPipeline = useCallback(async (name: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data: pipelineData, error } = await supabase.from('pipelines').insert({ user_id: user.id, name } as any).select().single();
    if (error || !pipelineData) throw error || new Error("Falha ao criar funil.");

    const pipelineDataTyped = pipelineData as any;
    const defaultStages = [ { name: 'Nova Etapa', sort_order: 0 } ];
    const stagesToInsert : TablesInsert<'pipeline_stages'>[] = defaultStages.map(s => ({ ...s, pipeline_id: pipelineDataTyped.id }));
    const { data: stagesData, error: stagesError } = await supabase.from('pipeline_stages').insert(stagesToInsert as any).select();

    if (stagesError || !stagesData) throw stagesError || new Error("Falha ao criar etapa inicial.");

    setPipelines(p => [...p, pipelineDataTyped as Pipeline]);
    setStages(s => [...s, ...(stagesData as PipelineStage[])]);
    setActivePipelineId(pipelineDataTyped.id);
  }, [user]);

  const updatePipeline = useCallback(async (id: string, name: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('pipelines').update({ name } as any).eq('id', id).select().single();
    if (error || !data) throw error || new Error("Falha ao renomear funil.");
    setPipelines(p => p.map(pl => pl.id === id ? (data as Pipeline) : pl));
  }, [user]);

  const deletePipeline = useCallback(async (id: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase.from('pipelines').delete().eq('id', id);
    if (error) throw error;

    setStages(s => s.filter(stage => stage.pipeline_id !== id));
    setDeals(d => d.filter(deal => deal.pipeline_id !== id));
    const remainingPipelines = pipelines.filter(p => p.id !== id);
    setPipelines(remainingPipelines);
    if (activePipelineId === id) {
        setActivePipelineId(remainingPipelines.length > 0 ? remainingPipelines[0].id : null);
    }
  }, [user, pipelines, activePipelineId]);

  const addStage = useCallback(async (pipelineId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const maxSortOrder = stages.filter(s => s.pipeline_id === pipelineId).reduce((max, s) => Math.max(max, s.sort_order), -1);
    const { data, error } = await supabase.from('pipeline_stages').insert({ pipeline_id: pipelineId, name: 'Nova Etapa', sort_order: maxSortOrder + 1 } as any).select().single();
    if (error || !data) throw error || new Error("Falha ao adicionar etapa.");
    setStages(s => [...s, data as PipelineStage]);
  }, [user, stages]);

  const updateStage = useCallback(async (id: string, name: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('pipeline_stages').update({ name } as any).eq('id', id).select().single();
    if (error || !data) throw error || new Error("Falha ao renomear etapa.");
    setStages(s => s.map(stage => stage.id === id ? (data as PipelineStage) : stage));
  }, [user]);

  const deleteStage = useCallback(async (id: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
    if (error) throw error;
    setStages(s => s.filter(stage => stage.id !== id));
  }, [user]);

  const value = useMemo(() => ({
    session, user, profile, loading, currentPage, pageParams, metaConfig,
    templates, contacts, contactDetails, campaigns, campaignDetails, segments, 
    automations, automationStats, pipelines, stages, deals, activePipelineId, 
    setTemplates, setAutomationStats, setActivePipelineId,
    // Functions
    setCurrentPage, updateProfile, addTemplate, addContact, updateContact,
    deleteContact, importContacts, fetchContactDetails, addCampaign,
    fetchCampaignDetails, createAndNavigateToAutomation,
    updateAutomation, deleteAutomation, fetchAutomationStats, fetchNodeLogs,
    addDeal, updateDealStage, createDefaultPipeline, addPipeline, updatePipeline, 
    deletePipeline, addStage, updateStage, deleteStage,
  }), [
    session, user, profile, loading, currentPage, pageParams, metaConfig, templates, contacts,
    contactDetails, campaigns, campaignDetails, segments, automations, automationStats, pipelines,
    stages, deals, activePipelineId, setCurrentPage, updateProfile, addTemplate, addContact,
    updateContact, deleteContact, importContacts, fetchContactDetails, addCampaign,
    fetchCampaignDetails, createAndNavigateToAutomation, updateAutomation, deleteAutomation,
    fetchAutomationStats, fetchNodeLogs, addDeal, updateDealStage, createDefaultPipeline,
    addPipeline, updatePipeline, deletePipeline, addStage, updateStage, deleteStage
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};