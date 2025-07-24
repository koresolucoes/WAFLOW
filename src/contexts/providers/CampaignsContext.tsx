
import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Campaign, CampaignWithMetrics, CampaignMessageInsert, CampaignWithDetails, CampaignMessageWithContact, CampaignStatus, MessageStatus, TemplateCategory, TemplateStatus } from '../../types';
import { MetaTemplateComponent } from '../../services/meta/types';
import { Tables, TablesInsert } from '../../types/database.types';
import { AuthContext } from './AuthContext';

interface CampaignsContextType {
  campaigns: CampaignWithMetrics[];
  campaignDetails: CampaignWithDetails | null;
  setCampaigns: React.Dispatch<React.SetStateAction<CampaignWithMetrics[]>>;
  setCampaignDetails: React.Dispatch<React.SetStateAction<CampaignWithDetails | null>>;
  addCampaign: (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & { status: CampaignStatus }, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => Promise<void>;
  fetchCampaignDetails: (campaignId: string) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
}

export const CampaignsContext = createContext<CampaignsContextType>(null!);

export const CampaignsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [campaignDetails, setCampaignDetails] = useState<CampaignWithDetails | null>(null);

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

      const typedMessagesData = (messagesData as unknown as CampaignMessageWithContact[]) || [];
      const delivered = typedMessagesData.filter(d => d.status === 'delivered' || d.status === 'read').length;
      const read = typedMessagesData.filter(d => d.status === 'read').length;
      
      const campaignDataTyped = campaignData as unknown as (Tables<'campaigns'> & { message_templates: Tables<'message_templates'> | null });
      const message_template_data = campaignDataTyped.message_templates;


      setCampaignDetails({
        ...(campaignDataTyped as unknown as Campaign),
        messages: typedMessagesData,
        status: campaignDataTyped.status as CampaignStatus,
        message_templates: message_template_data ? {
            ...(message_template_data as any),
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
  
  const addCampaign = useCallback(async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & {status: CampaignStatus}, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => {
    if (!user) throw new Error("User not authenticated.");
    
    const now = new Date().toISOString();
    const campaignPayload: TablesInsert<'campaigns'> = {
        ...campaign,
        user_id: user.id,
        created_at: now,
        sent_at: campaign.status === 'Sent' ? now : undefined,
        recipient_count: messages.length,
        status: campaign.status
    };
    const { data: newCampaignData, error: campaignError } = await supabase.from('campaigns').insert(campaignPayload as any).select().single();

    if (campaignError) throw campaignError;
    const newCampaign = newCampaignData as unknown as Tables<'campaigns'>;
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

  const deleteCampaign = useCallback(async (campaignId: string) => {
    if (!user) throw new Error("User not authenticated.");

    const { error: messagesError } = await supabase
        .from('campaign_messages')
        .delete()
        .eq('campaign_id', campaignId);
    
    if (messagesError) throw messagesError;

    const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

    if (campaignError) throw campaignError;

    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    if (campaignDetails?.id === campaignId) {
        setCampaignDetails(null);
    }
  }, [user, campaignDetails]);

  useEffect(() => {
    if (!user) return;

    const handleCampaignMessageUpdate = async (payload: any) => {
        if (payload.eventType !== 'UPDATE') return;

        const updatedMessage = payload.new as Tables<'campaign_messages'>;
        const campaignId = updatedMessage.campaign_id;

        // Find the campaign in the current state
        const campaignToUpdate = campaigns.find(c => c.id === campaignId);
        if (!campaignToUpdate) return; // Not a campaign we are currently displaying

        // Refetch metrics directly from the DB for accuracy
        const { data, error } = await supabase
            .from('campaign_messages')
            .select('status')
            .eq('campaign_id', campaignId);
            
        if (error) {
            console.error(`Realtime: Failed to refetch metrics for campaign ${campaignId}`, error);
            return;
        }

        const typedData = (data as unknown as { status: MessageStatus }[]) || [];
        const newMetrics = {
            sent: campaignToUpdate.metrics.sent, // 'sent' count does not change
            delivered: typedData.filter(d => d.status === 'delivered' || d.status === 'read').length,
            read: typedData.filter(d => d.status === 'read').length,
        };

        setCampaigns(prevCampaigns =>
            prevCampaigns.map(c =>
                c.id === campaignId ? { ...c, metrics: newMetrics } : c
            )
        );
    };

    const channel = supabase
        .channel('campaign-message-updates')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'campaign_messages' },
            handleCampaignMessageUpdate
        )
        .subscribe();
        
    return () => {
        supabase.removeChannel(channel);
    };
  }, [user, campaigns]);


  const value = {
    campaigns,
    setCampaigns,
    campaignDetails,
    setCampaignDetails,
    addCampaign,
    fetchCampaignDetails,
    deleteCampaign
  };
  
  return (
    <CampaignsContext.Provider value={value}>
        {children}
    </CampaignsContext.Provider>
  );
};