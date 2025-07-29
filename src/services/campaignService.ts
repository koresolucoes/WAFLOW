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

    const typedMessagesData = (messagesData as any as MessageWithContact[]) || [];
    
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
    campaign: Omit<Campaign, 'id' | 'team_id' | 'created_at' | 'recipient_count'>, 
    messages: Omit<MessageInsert, 'campaign_id' | 'team_id'>[]
): Promise<Campaign> => {
     const now = new Date().toISOString();
    const campaignPayload: TablesInsert<'campaigns'> = {
        ...campaign,
        team_id: teamId,
        created_at: now,
        sent_at: campaign.sent_at || (campaign.status === 'Sent' ? now : null),
        recipient_count: messages.length,
    };
    const { data: newCampaignData, error: campaignError } = await supabase.from('campaigns').insert(campaignPayload as any).select('id, created_at, name, recipient_count, sent_at, status, template_id, team_id').single();

    if (campaignError) throw campaignError;
    const newCampaign = newCampaignData as any;
    if (!newCampaign) throw new Error("Failed to create campaign.");

    if (messages.length > 0) {
        const messagesToInsert = messages.map(msg => ({ ...msg, campaign_id: newCampaign.id, team_id: teamId }));
        const { error: messagesError } = await supabase.from('messages').insert(messagesToInsert as any);

        if (messagesError) {
            // Rollback campaign creation if messages fail
            await supabase.from('campaigns').delete().eq('id', newCampaign.id);
            throw messagesError;
        }
    }

    return newCampaign as Campaign;
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