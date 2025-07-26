

import React, { createContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Campaign, CampaignWithMetrics, MessageInsert, CampaignWithDetails, CampaignStatus, Message, MessageStatus, MessageWithContact } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { fetchCampaignDetailsFromDb, addCampaignToDb, deleteCampaignFromDb } from '../../services/campaignService';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface CampaignsContextType {
  campaigns: CampaignWithMetrics[];
  campaignDetails: CampaignWithDetails | null;
  setCampaigns: React.Dispatch<React.SetStateAction<CampaignWithMetrics[]>>;
  setCampaignDetails: React.Dispatch<React.SetStateAction<CampaignWithDetails | null>>;
  addCampaign: (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & { status: CampaignStatus }, messages: Omit<MessageInsert, 'campaign_id' | 'user_id'>[]) => Promise<void>;
  fetchCampaignDetails: (campaignId: string) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
}

export const CampaignsContext = createContext<CampaignsContextType>(null!);

export const CampaignsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [campaignDetails, setCampaignDetails] = useState<CampaignWithDetails | null>(null);

  // Use a ref to access the latest campaignDetails in the subscription without causing re-renders.
  const campaignDetailsRef = useRef(campaignDetails);
  useEffect(() => {
    campaignDetailsRef.current = campaignDetails;
  }, [campaignDetails]);

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
  
  const addCampaign = useCallback(async (campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & {status: CampaignStatus}, messages: Omit<MessageInsert, 'campaign_id' | 'user_id'>[]) => {
    if (!user) throw new Error("User not authenticated.");
    
    const newCampaign = await addCampaignToDb(user.id, campaign, messages);
    const sentCount = messages.filter(m => m.status !== 'failed').length;

    const newCampaignWithMetrics: CampaignWithMetrics = {
        ...(newCampaign as Campaign),
        metrics: { 
            sent: sentCount, 
            delivered: 0, 
            read: 0, 
            failed: messages.length - sentCount 
        }
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

    const handleRealtimeMessageUpdate = async (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        if (payload.eventType !== 'UPDATE') return;
        const updatedMessage = payload.new as Message;
        const campaignId = updatedMessage.campaign_id;

        if (!campaignId) return;

        // Refetch metrics for the main list for accuracy
        const { data, error } = await supabase
            .from('messages')
            .select('status')
            .eq('campaign_id', campaignId);
            
        if (error) {
            console.error(`Realtime: Failed to refetch metrics for campaign ${campaignId}`, error);
            return;
        }

        const typedData = (data as unknown as { status: MessageStatus }[]) || [];
        const newMetrics = {
            sent: typedData.filter(d => d.status !== 'failed').length,
            delivered: typedData.filter(d => d.status === 'delivered' || d.status === 'read').length,
            read: typedData.filter(d => d.status === 'read').length,
            failed: typedData.filter(d => d.status === 'failed').length
        };

        // Update main campaigns list using a functional update
        setCampaigns(prevCampaigns =>
            prevCampaigns.map(c =>
                c.id === campaignId ? { ...c, metrics: newMetrics } : c
            )
        );

        // If the user is viewing the details of the updated campaign, refetch its data
        if (campaignDetailsRef.current && campaignDetailsRef.current.id === campaignId) {
            fetchCampaignDetails(campaignId);
        }
    };

    const channel = supabase
        .channel('campaign-message-updates')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages', filter: `user_id=eq.${user.id}` },
            handleRealtimeMessageUpdate
        )
        .subscribe();
        
    return () => {
        supabase.removeChannel(channel);
    };
  }, [user, fetchCampaignDetails]);


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