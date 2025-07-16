

import React, { createContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Page, Profile, MessageTemplate, Contact, Campaign, CampaignWithMetrics, EditableContact, Session, User, CampaignMessageInsert, CampaignWithDetails, CampaignMessageWithContact, Segment, MessageTemplateInsert, Automation, AutomationInsert, AutomationNode, Edge, AutomationNodeStats, AutomationNodeLog, CampaignStatus } from '../types';
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
}

export const AppContext = createContext<AppContextType>(null!);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPageInternal] = useState<Page>('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, any>>({});
  
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [campaignDetails, setCampaignDetails] = useState<CampaignWithDetails | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationStats, setAutomationStats] = useState<Record<string, AutomationNodeStats>>({});

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
          setProfile(null);
      }
      setSession(session);
      setUser(newUser);
    });

    return () => subscription.unsubscribe();
  }, [user]);

  const fetchInitialData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile, user might not have one yet. Relying on DB trigger.", profileError);
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      const [templatesRes, contactsRes, campaignsRes, segmentsRes, automationsRes] = await Promise.all([
          supabase.from('message_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('contacts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('campaigns').select('*').eq('user_id', user.id).order('sent_at', { ascending: false }),
          supabase.from('segments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('automations').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      if (templatesRes.error) console.error("Error fetching templates:", templatesRes.error);
      else setTemplates((templatesRes.data as unknown as MessageTemplate[]) || []);

      if (contactsRes.error) console.error("Error fetching contacts:", contactsRes.error);
      else setContacts((contactsRes.data as unknown as Contact[]) || []);

      if (campaignsRes.error) {
        console.error("Error fetching campaigns:", campaignsRes.error);
      } else if (campaignsRes.data) {
        await fetchCampaignsWithMetrics(campaignsRes.data as unknown as Campaign[]);
      }
      
      if (segmentsRes.error) console.error("Error fetching segments:", segmentsRes.error);
      else setSegments((segmentsRes.data as unknown as Segment[]) || []);
      
      if (automationsRes.error) {
        console.error("Error fetching automations:", automationsRes.error);
      } else if (automationsRes.data){
        const automationsData = automationsRes.data as unknown as Automation[];
        const sanitizedAutomations = automationsData.map(a => ({
          ...a,
          nodes: Array.isArray(a.nodes) ? a.nodes : [],
          edges: Array.isArray(a.edges) ? a.edges : [],
        }));
        setAutomations(sanitizedAutomations);
      }


      setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user && session && !profile) {
        fetchInitialData();
    }
  }, [user, session, profile, fetchInitialData]);

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
      
      const typedCampaignData = campaignData as unknown as (Campaign & { message_templates: MessageTemplate | null });

      const { data: messagesData, error: messagesError } = await supabase
        .from('campaign_messages')
        .select('*, contacts(name, phone)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
        
      if (messagesError) throw messagesError;

      const typedMessagesData = (messagesData as unknown as CampaignMessageWithContact[]) || [];
      const delivered = typedMessagesData.filter(d => d.status === 'delivered' || d.status === 'read').length || 0;
      const read = typedMessagesData.filter(d => d.status === 'read').length || 0;

      setCampaignDetails({
        ...typedCampaignData,
        messages: typedMessagesData,
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


  const setCurrentPage = useCallback((page: Page, params: Record<string, any> = {}) => {
    setCurrentPageInternal(page);
    setPageParams(params);
  }, []);

  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase.from('profiles').update(profileData as TablesUpdate<'profiles'>).eq('id', user.id).select().single();
    if(error) throw error;
    if (data) setProfile(data as Profile);
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
      .insert(dbTemplate as never) // Cast to never to bypass strict insert type
      .select()
      .single();
    if (error) throw error;
    if (data) {
        setTemplates(prev => [data as unknown as MessageTemplate, ...prev]);
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
      .insert(payload as never)
      .select()
      .single();
    if (error) throw error;
    if(data) {
      const newContact = data as unknown as Contact;
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
        .update(updatePayload as TablesUpdate<'contacts'>)
        .eq('id', updatedContact.id)
        .eq('user_id', user.id)
        .select()
        .single();
    if (error) throw error;
    if(data) {
      const newContact = data as unknown as Contact;
      setContacts(prev => prev.map(c => c.id === newContact.id ? newContact : c));
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
        const { data, error } = await supabase.from('contacts').insert(contactsToInsert as never[]).select();
        if (error) throw error;
        if(data) {
          const newContactsData = data as unknown as Contact[];
          setContacts(prev => [...newContactsData, ...prev].sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
          for(const contact of newContactsData) {
              await checkAndRunContactAutomations(contact);
          }
        }
    }

    return { importedCount: contactsToInsert.length, skippedCount };
  };

  const addCampaign = async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count'>, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const sent_at = new Date().toISOString();
    const campaignPayload: TablesInsert<'campaigns'> = { ...campaign, user_id: user.id, sent_at, recipient_count: messages.length };

    const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignPayload as never)
        .select()
        .single();

    if (campaignError) throw campaignError;
    const typedNewCampaign = newCampaign as unknown as Campaign;
    if (!typedNewCampaign) throw new Error("Failed to create campaign.");


    const messagesToInsert: TablesInsert<'campaign_messages'>[] = messages.map(msg => ({ ...msg, campaign_id: typedNewCampaign.id }));
    const { error: messagesError } = await supabase.from('campaign_messages').insert(messagesToInsert as never[]);

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
        .insert(dbAutomation as never)
        .select()
        .single();

    if (error) {
        console.error("Erro ao criar rascunho de automação:", error);
        throw error;
    }
    if (data) {
        const newAutomation = {
          ...(data as unknown as Automation),
          nodes: Array.isArray((data as any).nodes) ? (data as any).nodes : [],
          edges: Array.isArray((data as any).edges) ? (data as any).edges : [],
        } as Automation;
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
        .update(updatePayload as never)
        .eq('id', automation.id)
        .eq('user_id', user.id)
        .select()
        .single();

    if(error) throw error;
    if(data) {
      const updatedAutomation = {
          ...(data as unknown as Automation),
          nodes: Array.isArray((data as any).nodes) ? (data as any).nodes : [],
          edges: Array.isArray((data as any).edges) ? (data as any).edges : [],
      } as Automation;
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
        const statsMap = (data as unknown as AutomationNodeStats[]).reduce((acc, stat) => {
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
    return (data as unknown as AutomationNodeLog[]) || [];
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
    setAutomationStats
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
