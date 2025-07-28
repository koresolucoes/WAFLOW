import { supabase } from '../lib/supabaseClient';
import { Campaign, MessageInsert, CampaignWithDetails, MessageWithContact, CampaignStatus, TemplateCategory, TemplateStatus, MessageTemplate } from '../types';
import { TablesInsert, Tables } from '../types/database.types';
import { MetaTemplateComponent } from './meta/types';


export const fetchCampaignDetailsFromDb = async (teamId: string, campaignId: string): Promise<CampaignWithDetails> => {
    const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, message_templates(*)')
        .eq('id', campaignId)
        .eq('team_id', teamId)
        .single();
        
    if (campaignError || !campaignData) {
        throw campaignError || new Error("Campanha não encontrada ou acesso negado.");
    }
    
    const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*, contacts(name, phone)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
        
    if (messagesError) throw messagesError;

    const typedMessagesData = (messagesData as unknown as MessageWithContact[]) || [];
    
    const metrics = {
        sent: typedMessagesData.filter(d => d.status !== 'failed' && d.status !== 'pending').length,
        delivered: typedMessagesData.filter(d => d.status === 'delivered' || d.status === 'read').length,
        read: typedMessagesData.filter(d => d.status === 'read').length,
        failed: typedMessagesData.filter(d => d.status === 'failed').length
    };
    
    const campaignDataTyped = campaignData as unknown as (Tables<'campaigns'> & { message_templates: Tables<'message_templates'> | null });
    const message_template_data = campaignDataTyped.message_templates;

    return {
        ...(campaignDataTyped as Campaign),
        messages: typedMessagesData,
        status: campaignDataTyped.status as CampaignStatus,
        message_templates: message_template_data ? {
            ...(message_template_data as any),
            category: message_template_data.category as TemplateCategory,
            status: message_template_data.status as TemplateStatus,
            components: (message_template_data.components as unknown as MetaTemplateComponent[]) || []
        } : null,
        metrics,
    };
};

export const addCampaignToDb = async (
    teamId: string, 
    campaignData: Omit<TablesInsert<'campaigns'>, 'id' | 'team_id' | 'created_at' | 'recipient_count'>,
    recipientCount: number
): Promise<Campaign> => {
    const campaignPayload: TablesInsert<'campaigns'> = {
        ...campaignData,
        team_id: teamId,
        recipient_count: recipientCount,
    };

    const { data: newCampaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignPayload as any)
        .select('*')
        .single();

    if (campaignError) {
        console.error("Error creating campaign in DB:", campaignError);
        throw campaignError;
    }
    if (!newCampaignData) {
        throw new Error("Failed to create campaign record in database.");
    }

    return newCampaignData as unknown as Campaign;
};


export const deleteCampaignFromDb = async (teamId: string, campaignId: string): Promise<void> => {
     const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('team_id', teamId);
    
    if (messagesError) throw messagesError;

    const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('team_id', teamId);

    if (campaignError) throw campaignError;
};
