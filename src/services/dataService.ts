import { supabase } from '../lib/supabaseClient';
import { Campaign, CampaignWithMetrics, MessageStatus, TemplateCategory, TemplateStatus, AutomationStatus, Edge, AutomationNode, Contact, MessageTemplate, Automation, Pipeline, PipelineStage, DealWithContact } from '../types';
import { MetaTemplateComponent } from './meta/types';
import { Tables } from '../types/database.types';

const fetchCampaignsWithMetrics = async (campaignsData: Campaign[]): Promise<CampaignWithMetrics[]> => {
    return Promise.all(
        campaignsData.map(async (campaign) => {
            const { data, error, count } = await supabase
                .from('campaign_messages')
                .select('status', { count: 'exact', head: false })
                .eq('campaign_id', campaign.id);

            if (error) {
                console.error(`Error fetching metrics for campaign ${campaign.id}:`, error);
                return { ...campaign, recipient_count: campaign.recipient_count || 0, metrics: { sent: campaign.recipient_count || 0, delivered: 0, read: 0 } };
            }
            
            const typedData = (data as unknown as {status: MessageStatus}[]) || [];
            const delivered = typedData.filter(d => d.status === 'delivered' || d.status === 'read').length;
            const read = typedData.filter(d => d.status === 'read').length;

            return {
                ...campaign,
                recipient_count: campaign.recipient_count || 0,
                metrics: { sent: count || campaign.recipient_count || 0, delivered, read }
            };
        })
    );
};


export const fetchAllInitialData = async (userId: string) => {
    const [templatesRes, contactsRes, campaignsRes, automationsRes, pipelinesRes, stagesRes, dealsRes] = await Promise.all([
        supabase.from('message_templates').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('automations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('pipelines').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('pipeline_stages').select('*, pipelines!inner(user_id)').eq('pipelines.user_id', userId),
        supabase.from('deals').select('*, contacts(id, name)').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    if (templatesRes.error) console.error("DataService Error (Templates):", templatesRes.error);
    if (contactsRes.error) console.error("DataService Error (Contacts):", contactsRes.error);
    if (campaignsRes.error) console.error("DataService Error (Campaigns):", campaignsRes.error);
    if (automationsRes.error) console.error("DataService Error (Automations):", automationsRes.error);
    if (pipelinesRes.error) console.error("DataService Error (Pipelines):", pipelinesRes.error);
    if (stagesRes.error) console.error("DataService Error (Stages):", stagesRes.error);
    if (dealsRes.error) console.error("DataService Error (Deals):", dealsRes.error);

    // Process Templates
    const templates = (templatesRes.data || []).map(t => ({
        ...t,
        category: t.category as TemplateCategory,
        status: t.status as TemplateStatus,
        components: (t.components as unknown as MetaTemplateComponent[]) || [],
    } as MessageTemplate));
    
    // Process Automations
    const automationsData = (automationsRes.data || []);
    const automations = automationsData.map((a) => ({
        ...a,
        nodes: (Array.isArray(a.nodes) ? a.nodes : []) as unknown as AutomationNode[],
        edges: (Array.isArray(a.edges) ? a.edges : []) as unknown as Edge[],
        status: a.status as AutomationStatus,
    } as Automation));
    
    // Process Campaigns
    const campaigns = await fetchCampaignsWithMetrics((campaignsRes.data || []) as Campaign[]);

    return {
        templates,
        contacts: (contactsRes.data || []) as Contact[],
        campaigns,
        automations,
        pipelines: (pipelinesRes.data || []) as Pipeline[],
        stages: (stagesRes.data || []) as PipelineStage[],
        deals: (dealsRes.data || []) as DealWithContact[],
    };
};