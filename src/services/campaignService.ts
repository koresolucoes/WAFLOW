import { supabase } from '../lib/supabaseClient';
import { Campaign, CampaignMessageInsert, CampaignWithDetails, CampaignMessageWithContact, CampaignStatus, TemplateCategory, TemplateStatus, MessageTemplate } from '../types';
import { TablesInsert, Tables } from '../types/database.types';
import { MetaTemplateComponent } from './meta/types';


export const fetchCampaignDetailsFromDb = async (userId: string, campaignId: string): Promise<CampaignWithDetails> => {
    const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, message_templates(*)')
        .eq('id', campaignId)
        .eq('user_id', userId)
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
    
    const campaignDataTyped = campaignData as (Tables<'campaigns'> & { message_templates: Tables<'message_templates'> | null });
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
        metrics: {
          sent: campaignDataTyped.recipient_count || 0,
          delivered,
          read
        }
    };
};

export const addCampaignToDb = async (
    userId: string, 
    campaign: Omit<Campaign, 'id' | 'user_id' | 'sent_at' | 'created_at' | 'recipient_count' | 'status'> & { status: CampaignStatus }, 
    messages: Omit<CampaignMessageInsert, 'campaign_id'>[]
): Promise<Campaign> => {
     const now = new Date().toISOString();
    const campaignPayload: TablesInsert<'campaigns'> = {
        ...campaign,
        user_id: userId,
        created_at: now,
        sent_at: campaign.status === 'Sent' ? now : undefined,
        recipient_count: messages.length,
        status: campaign.status
    };
    const { data: newCampaignData, error: campaignError } = await supabase.from('campaigns').insert(campaignPayload).select('*').single();

    if (campaignError) throw campaignError;
    const newCampaign = newCampaignData;
    if (!newCampaign) throw new Error("Failed to create campaign.");

    if (messages.length > 0) {
        const messagesToInsert = messages.map(msg => ({ ...msg, campaign_id: newCampaign.id }));
        const { error: messagesError } = await supabase.from('campaign_messages').insert(messagesToInsert);

        if (messagesError) {
            // Rollback campaign creation if messages fail
            await supabase.from('campaigns').delete().eq('id', newCampaign.id);
            throw messagesError;
        }
    }

    return newCampaign as Campaign;
};


export const deleteCampaignFromDb = async (userId: string, campaignId: string): Promise<void> => {
     const { error: messagesError } = await supabase
        .from('campaign_messages')
        .delete()
        .eq('campaign_id', campaignId);
    
    if (messagesError) throw messagesError;

    const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('user_id', userId);

    if (campaignError) throw campaignError;
};