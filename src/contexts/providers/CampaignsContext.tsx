



import React, { createContext, useState, useCallback, ReactNode, useContext, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Campaign, CampaignWithMetrics, CampaignMessageInsert, CampaignWithDetails, CampaignStatus, MessageStatus, Tables } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { fetchCampaignDetailsFromDb, addCampaignToDb, deleteCampaignFromDb } from '../../services/campaignService';

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
  const user = useAuthStore(state => state.user);
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [campaignDetails, setCampaignDetails] = useState<CampaignWithDetails | null>(null);

  const fetchCampaignDetails = useCallback(async (campaignId: string) => {
    if (!user) return;
    try {
        const details = await fetchCampaignDetailsFromDb(user.id, campaignId);
        setCampaignDetails(details);
    } catch (err) {
        console.error("Error in Campaign Context fetching details:", (err as any).message || err);
        throw err;
    }
  }, [user]);
  
  const addCampaign = useCallback(async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & {status: CampaignStatus}, messages: Omit<CampaignMessageInsert, 'campaign_id'>[]) => {
    if (!user) throw new Error("User not authenticated.");
    
    const newCampaign = await addCampaignToDb(user.id, campaign, messages);
    const sentCount = messages.filter(m => m.status !== 'failed').length;

    const newCampaignWithMetrics: CampaignWithMetrics = {
        ...(newCampaign as Campaign),
        metrics: { sent: sentCount, delivered: 0, read: 0 }
    };
    setCampaigns(prev => [newCampaignWithMetrics, ...prev]);
  }, [user]);

  const deleteCampaign = useCallback(async (campaignId: string) => {
    if (!user) throw new Error("User not authenticated.");

    await deleteCampaignFromDb(user.id, campaignId);

    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    if (campaignDetails?.id === campaignId) {
        setCampaignDetails(null);
    }
  }, [user, campaignDetails]);

  useEffect(() => {
    if (!user) return;

    const handleCampaignMessageUpdate = async (payload: { new: Tables<'campaign_messages'>, eventType: string }) => {
        if (payload.eventType !== 'UPDATE') return;

        const updatedMessage = payload.new;
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

        const typedData = (data as { status: MessageStatus }[]) || [];
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