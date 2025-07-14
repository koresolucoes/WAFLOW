
import React, { createContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Page, Profile, MessageTemplate, Contact, Campaign, CampaignWithMetrics, EditableContact, Session, User, CampaignMessageInsert, CampaignWithDetails, CampaignMessageWithContact, Segment, MessageTemplateInsert, Automation, AutomationInsert, AutomationNode, Edge, TablesInsert, Json } from '../types';

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
    webhookVerifyToken?: string;
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
  addCampaign: (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'metrics'>, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => Promise<void>;
  
  campaignDetails: CampaignWithDetails | null;
  fetchCampaignDetails: (campaignId: string) => Promise<void>;

  segments: Segment[];
  
  automations: Automation[];
  addAutomation: (automation: Omit<AutomationInsert, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  updateAutomation: (automation: Automation) => Promise<void>;
  deleteAutomation: (automationId: string) => Promise<void>;
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

  useEffect(() => {
    const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchInitialData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        console.warn("Profile not found for user, creating a default one.");
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, company_name: 'Minha Nova Empresa' } as TablesInsert<'profiles'>)
          .select()
          .single();
        
        if (insertError) {
          console.error("Fatal: Could not create profile for user.", insertError);
          setLoading(false);
          return;
        }
        profileData = newProfile as unknown as Profile;
      } else if (profileError) {
        console.error("Error fetching profile:", profileError);
      }

      if (profileData) {
        setProfile(profileData as Profile);
      } else {
        console.error("Could not load or create a user profile. App may not function correctly.");
        setLoading(false);
        return;
      }

      const [templatesRes, contactsRes, campaignsRes, segmentsRes, automationsRes] = await Promise.all([
          supabase.from('message_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('contacts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('campaigns').select('*').eq('user_id', user.id).order('sent_at', { ascending: false }),
          supabase.from('segments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('automations').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      if (templatesRes.data) setTemplates(templatesRes.data as unknown as MessageTemplate[]);
      else if (templatesRes.error) console.error("Error fetching templates:", templatesRes.error);

      if (contactsRes.data) setContacts(contactsRes.data as unknown as Contact[]);
      else if (contactsRes.error) console.error("Error fetching contacts:", contactsRes.error);

      if (campaignsRes.data) {
          await fetchCampaignsWithMetrics(campaignsRes.data as unknown as Campaign[]);
      } else if (campaignsRes.error) {
          console.error("Error fetching campaigns:", campaignsRes.error);
      }
      
      if (segmentsRes.data) setSegments(segmentsRes.data as unknown as Segment[]);
      else if (segmentsRes.error) console.error("Error fetching segments:", segmentsRes.error);
      
      if (automationsRes.data) setAutomations(automationsRes.data as unknown as Automation[]);
      else if (automationsRes.error) console.error("Error fetching automations:", automationsRes.error);


      setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user && session) {
        fetchInitialData();
    }
  }, [user, session, fetchInitialData]);

  const fetchCampaignsWithMetrics = async (campaignsData: Campaign[]) => {
    const campaignsWithMetrics: CampaignWithMetrics[] = await Promise.all(
        campaignsData.map(async (campaign) => {
            const { data, error, count } = await supabase
                .from('campaign_messages')
                .select('status', { count: 'exact' })
                .eq('campaign_id', campaign.id);

            if (error) {
                console.error(`Error fetching metrics for campaign ${campaign.id}:`, error);
                return { ...campaign, metrics: { sent: campaign.recipient_count || 0, delivered: 0, read: 0 } };
            }
            
            const typedData = (data as unknown as { status: string }[] | null) || [];
            const delivered = typedData.filter(d => d.status === 'delivered' || d.status === 'read').length || 0;
            const read = typedData.filter(d => d.status === 'read').length || 0;

            return {
                ...campaign,
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
    const { data, error } = await supabase.from('profiles').update(profileData).eq('id', user.id).select().single();
    if(error) throw error;
    if (data) setProfile(data as unknown as Profile);
  };
  
  const metaConfig = useMemo(() => ({
    accessToken: profile?.meta_access_token || '',
    wabaId: profile?.meta_waba_id || '',
    phoneNumberId: profile?.meta_phone_number_id || '',
    webhookVerifyToken: profile?.meta_webhook_verify_token || '',
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
        setTemplates(prev => [data as unknown as MessageTemplate, ...prev]);
    }
  };
  
    // --- Automação ---
  const executeAutomation = async (automation: Automation, contact: Contact) => {
      // Esta função precisa de uma refatoração completa para o motor de fluxo.
      // A lógica de execução agora está no webhook.
      console.log(`Disparando automação ${automation.name} para ${contact.name}`);
  };
  
  const checkAndRunContactAutomations = useCallback(async (contact: Contact, previousContactState?: Contact) => {
    // Esta função precisa ser repensada. O gatilho agora é verificado no webhook.
    // Manterei uma lógica simples por enquanto.
    const activeAutomations = automations.filter(a => a.status === 'active');

    for (const auto of activeAutomations) {
        const triggerNode = auto.nodes?.find(n => n.data.nodeType === 'trigger' && n.data.type === 'new_contact_with_tag');
        if (!triggerNode) continue;
        
        const triggerTag = (triggerNode.data.config as any)?.tag;
        if (!triggerTag) continue;

        const hasTagNow = contact.tags?.includes(triggerTag);
        const hadTagBefore = previousContactState?.tags?.includes(triggerTag);
        
        if(hasTagNow && !hadTagBefore) {
            console.log(`Gatilho 'new_contact_with_tag' para automação '${auto.name}' disparado para o contato ${contact.name}`);
            // A execução real acontece no backend/webhook para consistência.
            // Apenas logamos aqui.
        }
    }
  }, [automations]);


  const addContact = async (contact: EditableContact) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...contact, user_id: user.id })
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
     
     const { data, error } = await supabase
        .from('contacts')
        .update(updatedContact)
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
            contactsToInsert.push({ ...contact, user_id: user.id } as TablesInsert<'contacts'>);
            existingPhones.add(sanitizedPhone);
        } else {
            skippedCount++;
        }
    });

    if (contactsToInsert.length > 0) {
        const { data, error } = await supabase.from('contacts').insert(contactsToInsert).select();
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

  const addCampaign = async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'metrics'>, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const sent_at = new Date().toISOString();
    const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({ ...campaign, user_id: user.id, sent_at })
        .select()
        .single();

    if (campaignError) throw campaignError;
    if (!newCampaign) throw new Error("Failed to create campaign.");

    const typedNewCampaign = newCampaign as unknown as Campaign;

    const messagesToInsert = messages.map(msg => ({ ...msg, campaign_id: typedNewCampaign.id }));
    const { error: messagesError } = await supabase.from('campaign_messages').insert(messagesToInsert);

    if (messagesError) {
        await supabase.from('campaigns').delete().eq('id', typedNewCampaign.id);
        throw messagesError;
    }
    
    const sentCount = messages.filter(m => m.status !== 'failed').length;

    const newCampaignWithMetrics: CampaignWithMetrics = {
        ...(typedNewCampaign as Campaign),
        metrics: {
            sent: sentCount,
            delivered: 0,
            read: 0
        }
    };
    setCampaigns(prev => [newCampaignWithMetrics, ...prev]);
  };

  const addAutomation = async (automation: Omit<AutomationInsert, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const dbAutomation = {
      ...automation,
      user_id: user.id,
      nodes: automation.nodes as unknown as Json,
      edges: automation.edges as unknown as Json,
    };
    const { data, error } = await supabase
        .from('automations')
        .insert(dbAutomation)
        .select()
        .single();
    if (error) throw error;
    if(data) setAutomations(prev => [data as unknown as Automation, ...prev]);
  };

  const updateAutomation = async (automation: Automation) => {
    if (!user) throw new Error("Usuário não autenticado.");
    
    const { data, error } = await supabase
        .from('automations')
        .update({
            name: automation.name,
            status: automation.status,
            nodes: automation.nodes as unknown as Json,
            edges: automation.edges as unknown as Json
        })
        .eq('id', automation.id)
        .eq('user_id', user.id)
        .select()
        .single();
    if(error) throw error;
    if(data) setAutomations(prev => prev.map(a => a.id === (data as Automation).id ? data as unknown as Automation : a));
  };
  
  const deleteAutomation = async (automationId: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const { error } = await supabase.from('automations').delete().eq('id', automationId);
    if (error) throw error;
    setAutomations(prev => prev.filter(a => a.id !== automationId));
  };

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
    addAutomation,
    updateAutomation,
    deleteAutomation
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
