
import React, { createContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Page, Profile, MessageTemplate, Contact, Campaign, CampaignWithMetrics, EditableContact, Session, User, CampaignMessageInsert, CampaignWithDetails, CampaignMessageWithContact, Segment, MessageTemplateInsert, Automation, AutomationInsert, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, CampaignStatus, MessageStatus, Pipeline, PipelineStage, Deal, DealInsert, ContactWithDetails, DealWithContact } from '../types';
import { Json, TablesInsert, TablesUpdate } from '../types/database.types';

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
  updateProfile: (profileData: Partial<Profile>) => Promise<void>;

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


  useEffect(() => {
    const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      if (user?.id !== newUser?.id) {
          // Reset all data for new user to prevent stale data flashing
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
          setInitialDataLoaded(false); // Allow data to be fetched for the new user
      }
      setSession(session);
      setUser(newUser);
    });

    return () => subscription.unsubscribe();
  }, [user]);

  const fetchCampaignsWithMetrics = async (campaignsData: Campaign[]) => {
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
            
            const typedData = (data as { status: MessageStatus }[]) || [];
            const delivered = typedData.filter(d => d.status === 'delivered' || d.status === 'read').length || 0;
            const read = typedData.filter(d => d.status === 'read').length || 0;

            return {
                ...campaign,
                recipient_count: campaign.recipient_count || 0,
                metrics: { sent: count || campaign.recipient_count || 0, delivered, read }
            };
        })
    );
    setCampaigns(campaignsWithMetrics);
  }
  
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
          } else {
            setProfile(profileData);
          }

          const [templatesRes, contactsRes, campaignsRes, segmentsRes, automationsRes, pipelinesRes, stagesRes, dealsRes] = await Promise.all([
              supabase.from('message_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('contacts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('campaigns').select('*').eq('user_id', user.id).order('sent_at', { ascending: false }),
              supabase.from('segments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('automations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
              supabase.from('pipelines').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
              supabase.from('pipeline_stages').select('*, pipelines!inner(user_id)'),
              supabase.from('deals').select('*, contacts(id, name)').eq('user_id', user.id).order('created_at', { ascending: false }),
          ]);

          if (templatesRes.error) console.error("Error fetching templates:", templatesRes.error);
          else setTemplates(templatesRes.data as MessageTemplate[]);

          if (contactsRes.error) console.error("Error fetching contacts:", contactsRes.error);
          else setContacts(contactsRes.data);

          if (campaignsRes.error) {
            console.error("Error fetching campaigns:", campaignsRes.error);
          } else if (campaignsRes.data) {
            await fetchCampaignsWithMetrics(campaignsRes.data);
          }
          
          if (segmentsRes.error) console.error("Error fetching segments:", segmentsRes.error);
          else setSegments(segmentsRes.data);
          
          if (automationsRes.error) {
            console.error("Error fetching automations:", automationsRes.error);
          } else if (automationsRes.data){
            const automationsData = automationsRes.data as any[];
            const sanitizedAutomations: Automation[] = automationsData.map(a => ({
              ...a,
              nodes: Array.isArray(a.nodes) ? a.nodes : [],
              edges: Array.isArray(a.edges) ? a.edges : [],
              status: a.status as AutomationStatus,
            }));
            setAutomations(sanitizedAutomations);
          }
          
          if (pipelinesRes.error) console.error("Error fetching pipelines:", pipelinesRes.error);
          else setPipelines(pipelinesRes.data);
          
          if (stagesRes.error) console.error("Error fetching stages:", stagesRes.error);
          else {
              const userStages = stagesRes.data?.filter((s: any) => s.pipelines.user_id === user.id)
              setStages(userStages as PipelineStage[]);
          }
          
          if (dealsRes.error) console.error("Error fetching deals:", dealsRes.error);
          else setDeals(dealsRes.data as DealWithContact[]);

      } catch (err) {
        console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
      } finally {
        setLoading(false);
      }
  }, [user]);

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
      
      const typedCampaignData = campaignData as (Campaign & { message_templates: MessageTemplate | null });

      const { data: messagesData, error: messagesError } = await supabase
        .from('campaign_messages')
        .select('*, contacts(name, phone)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
        
      if (messagesError) throw messagesError;

      const typedMessagesData = (messagesData as CampaignMessageWithContact[]) || [];
      const delivered = typedMessagesData.filter(d => d.status === 'delivered' || d.status === 'read').length || 0;
      const read = typedMessagesData.filter(d => d.status === 'read').length || 0;

      setCampaignDetails({
        ...typedCampaignData,
        messages: typedMessagesData,
        status: typedCampaignData.status as CampaignStatus,
        metrics: {
          sent: typedCampaignData.recipient_count || 0,
          delivered,
          read
        }
      });

    } catch (err) {
      console.error("Error fetching campaign details:", (err as any).message || err);
      // O erro será tratado no componente que chama a função.
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

  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('profiles').update(profileData).eq('id', user.id).select().single();
    if(error) throw error;
    if (data) setProfile(data);
  };
  
  const metaConfig = useMemo(() => ({
    accessToken: profile?.meta_access_token || '',
    wabaId: profile?.meta_waba_id || '',
    phoneNumberId: profile?.meta_phone_number_id || '',
  }), [profile]);


  const addTemplate = async (template: MessageTemplateInsert) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const dbTemplate: TablesInsert<'message_templates'> = {
        ...template,
        components: template.components as unknown as Json,
    };
    
    const { data, error } = await supabase
      .from('message_templates')
      .insert(dbTemplate)
      .select()
      .single();
    if (error) throw error;
    if (data) {
        setTemplates(prev => [data as MessageTemplate, ...prev]);
    }
  };
  
  const checkAndRunContactAutomations = useCallback(async (contact: Contact, previousContactState?: Contact) => {
    if (!user) return;

    // A. Handle 'new_contact' trigger
    // This is fired when a contact is created and there's no previous state.
    if (!previousContactState) {
        console.log(`Frontend: Firing 'new_contact' trigger for ${contact.name}`);
        fetch('/api/run-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                triggerType: 'new_contact',
                userId: user.id,
                contactId: contact.id,
            })
        }).catch(err => console.error("Failed to call new_contact trigger API", err));
        
        // When a new contact is created, all its initial tags are considered "added".
        const initialTags = contact.tags || [];
        for (const tag of initialTags) {
            console.log(`Frontend: Firing 'new_contact_with_tag' for new contact's tag: ${tag}`);
             fetch('/api/run-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    triggerType: 'new_contact_with_tag',
                    userId: user.id,
                    contactId: contact.id,
                    data: { addedTag: tag }
                })
            }).catch(err => console.error("Failed to call new_contact_with_tag trigger API", err));
        }

        return; // Exit after handling new contact case
    }
    
    // B. Handle 'new_contact_with_tag' for existing contacts
    const oldTags = new Set(previousContactState?.tags || []);
    const newTags = contact.tags || [];
    
    for (const tag of newTags) {
        if (!oldTags.has(tag)) {
            console.log(`Frontend: Firing 'new_contact_with_tag' for existing contact's new tag: ${tag}`);
            // Fire and forget
            fetch('/api/run-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    triggerType: 'new_contact_with_tag',
                    userId: user.id,
                    contactId: contact.id,
                    data: { addedTag: tag }
                })
            }).catch(err => console.error("Failed to call new_contact_with_tag trigger API", err));
        }
    }

  }, [user]);


  const addContact = async (contact: EditableContact) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const payload: TablesInsert<'contacts'> = { ...contact, user_id: user.id };
    const { data, error } = await supabase
      .from('contacts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    if(data) {
      const newContact = data as Contact;
      setContacts(prev => [newContact, ...prev]);
      await checkAndRunContactAutomations(newContact);
    }
  };
  
  const updateContact = async (updatedContact: Contact) => {
     if (!user) throw new Error("Usuário não autenticado.");
     const oldContact = contacts.find(c => c.id === updatedContact.id);
     
     const { id, created_at, user_id, ...updatePayload } = updatedContact;
     const { data, error } = await supabase
        .from('contacts')
        .update(updatePayload)
        .eq('id', updatedContact.id)
        .eq('user_id', user.id)
        .select()
        .single();
    if (error) throw error;
    if(data) {
      const newContact = data as Contact;
      setContacts(prev => prev.map(c => c.id === newContact.id ? newContact : c));
      
      // Update details page if it's the current contact being viewed
      if(contactDetails?.id === newContact.id) {
          setContactDetails(prev => prev ? {...prev, ...newContact} : null)
      }

      await checkAndRunContactAutomations(newContact, oldContact);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', user.id);
    if (error) throw error;
    setContacts(prev => prev.filter(c => c.id !== contactId));
  };
  
  const importContacts = async (newContacts: EditableContact[]): Promise<{ importedCount: number; skippedCount: number }> => {
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
        const { data, error } = await supabase.from('contacts').insert(contactsToInsert).select();
        if (error) throw error;
        if(data) {
          const newContactsData = data as Contact[];
          setContacts(prev => [...newContactsData, ...prev].sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
          for(const contact of newContactsData) {
              await checkAndRunContactAutomations(contact);
          }
        }
    }

    return { importedCount: contactsToInsert.length, skippedCount };
  };

  const addCampaign = async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & {status: CampaignStatus}, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const sent_at = new Date().toISOString();
    const campaignPayload: TablesInsert<'campaigns'> = { ...campaign, user_id: user.id, sent_at, recipient_count: messages.length, status: campaign.status };

    const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignPayload)
        .select()
        .single();

    if (campaignError) throw campaignError;
    const typedNewCampaign = newCampaign as Campaign;
    if (!typedNewCampaign) throw new Error("Failed to create campaign.");


    const messagesToInsert: TablesInsert<'campaign_messages'>[] = messages.map(msg => ({ ...msg, campaign_id: typedNewCampaign.id }));
    const { error: messagesError } = await supabase.from('campaign_messages').insert(messagesToInsert);

    if (messagesError) {
        await supabase.from('campaigns').delete().eq('id', typedNewCampaign.id);
        throw messagesError;
    }
    
    const sentCount = messages.filter(m => m.status !== 'failed').length;

    const newCampaignWithMetrics: CampaignWithMetrics = {
        ...typedNewCampaign,
        metrics: {
            sent: sentCount,
            delivered: 0,
            read: 0
        }
    };
    setCampaigns(prev => [newCampaignWithMetrics, ...prev]);
  };
  
  const addDeal = async (dealData: DealInsert) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('deals').insert(dealData).select('*, contacts(id, name)').single();
    if(error) throw error;
    if (data) {
        setDeals(prev => [data as DealWithContact, ...prev]);
    }
  };

  const updateDealStage = async (dealId: string, newStageId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId).select('*, contacts(id, name)').single();
    if(error) throw error;
    if (data) {
        setDeals(prev => prev.map(d => d.id === dealId ? data as DealWithContact : d));
    }
  };


  const createAndNavigateToAutomation = async () => {
    if (!user) throw new Error("Usuário não autenticado.");

    const dbAutomation: TablesInsert<'automations'> = {
        user_id: user.id,
        name: 'Nova Automação (Rascunho)',
        status: 'paused',
        nodes: [] as unknown as Json,
        edges: [] as unknown as Json,
    };

    const { data, error } = await supabase
        .from('automations')
        .insert(dbAutomation)
        .select()
        .single();

    if (error) {
        console.error("Erro ao criar rascunho de automação:", error);
        throw error;
    }
    if (data) {
        const newAutomation: Automation = {
          ...(data as any),
          nodes: Array.isArray((data as any).nodes) ? (data as any).nodes : [],
          edges: Array.isArray((data as any).edges) ? (data as any).edges : [],
          status: (data as any).status as AutomationStatus,
        };
        setAutomations(prev => [newAutomation, ...prev]);
        setCurrentPage('automation-editor', { automationId: newAutomation.id });
    }
  };

  const updateAutomation = async (automation: Automation) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const updatePayload: TablesUpdate<'automations'> = {
        name: automation.name,
        status: automation.status,
        nodes: automation.nodes as unknown as Json,
        edges: automation.edges as unknown as Json
    };

    const { data, error } = await supabase
        .from('automations')
        .update(updatePayload)
        .eq('id', automation.id)
        .eq('user_id', user.id)
        .select()
        .single();

    if(error) throw error;
    if(data) {
      const updatedAutomation: Automation = {
          ...(data as any),
          nodes: Array.isArray((data as any).nodes) ? (data as any).nodes : [],
          edges: Array.isArray((data as any).edges) ? (data as any).edges : [],
          status: (data as any).status as AutomationStatus,
      };
      setAutomations(prev => prev.map(a => a.id === updatedAutomation.id ? updatedAutomation : a));
    }
  };
  
  const deleteAutomation = async (automationId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase.from('automations').delete().eq('id', automationId);
    if (error) throw error;
    setAutomations(prev => prev.filter(a => a.id !== automationId));
  };
  
  const fetchAutomationStats = useCallback(async (automationId: string) => {
    if (!user) return;
    const { data, error } = await supabase
        .from('automation_node_stats')
        .select('*')
        .eq('automation_id', automationId);
    
    if (error) {
        console.error("Error fetching automation stats:", error);
        return;
    }
    
    if (data) {
        const statsMap = (data as AutomationNodeStats[]).reduce((acc, stat) => {
            acc[stat.node_id] = stat;
            return acc;
        }, {} as Record<string, AutomationNodeStats>);
        setAutomationStats(prev => ({...prev, ...statsMap}));
    }
  }, [user]);

  const fetchNodeLogs = useCallback(async (automationId: string, nodeId: string): Promise<AutomationNodeLog[]> => {
    if (!user) return [];
    
    const { data: runIdsData, error: runIdsError } = await supabase
        .from('automation_runs')
        .select('id')
        .eq('automation_id', automationId);

    if (runIdsError || !runIdsData) {
        console.error('Error fetching run IDs for logs:', runIdsError);
        return [];
    }

    const runIds = (runIdsData as {id: string}[]).map(r => r.id);
    if (runIds.length === 0) return [];

    const { data, error } = await supabase
        .from('automation_node_logs')
        .select('*')
        .in('run_id', runIds)
        .eq('node_id', nodeId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching node logs:", error);
        return [];
    }
    return (data as AutomationNodeLog[]) || [];
  }, [user]);


  const value: AppContextType = {
    session,
    user,
    profile,
    loading,
    currentPage,
    setCurrentPage,
    pageParams,
    metaConfig,
    updateProfile,
    templates,
    setTemplates,
    addTemplate,
    contacts,
    addContact,
    updateContact,
    deleteContact,
    importContacts,
    contactDetails,
    fetchContactDetails,
    campaigns,
    addCampaign,
    campaignDetails,
    fetchCampaignDetails,
    segments,
    automations,
    createAndNavigateToAutomation,
    updateAutomation,
    deleteAutomation,
    automationStats,
    fetchAutomationStats,
    fetchNodeLogs,
    setAutomationStats,
    pipelines,
    stages,
    deals,
    addDeal,
    updateDealStage
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
