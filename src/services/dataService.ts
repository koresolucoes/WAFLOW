
import { supabase } from '../lib/supabaseClient';
import { Campaign, CampaignWithMetrics, MessageStatus, TemplateCategory, TemplateStatus, AutomationStatus, Edge, AutomationNode, Contact, MessageTemplate, Automation, Pipeline, PipelineStage, DealWithContact, CustomFieldDefinition } from '../types';
import { MetaTemplateComponent } from './meta/types';

const fetchCampaignsWithMetrics = async (campaignsData: Campaign[]): Promise<CampaignWithMetrics[]> => {
    if (campaignsData.length === 0) return [];

    const campaignIds = campaignsData.map(c => c.id);
    const { data, error } = await supabase
        .from('messages')
        .select('campaign_id, status')
        .in('campaign_id', campaignIds);

    if (error) {
        console.error("Error fetching campaign metrics:", error);
        return campaignsData.map(c => ({
            ...c,
            metrics: { sent: 0, delivered: 0, read: 0, failed: 0 }
        }));
    }

    const metricsByCampaignId = data.reduce((acc, msg) => {
        if (!msg.campaign_id) return acc;
        if (!acc[msg.campaign_id]) {
            acc[msg.campaign_id] = { sent: 0, delivered: 0, read: 0, failed: 0 };
        }
        if (msg.status !== 'failed') {
            acc[msg.campaign_id].sent++;
        }
        if (msg.status === 'delivered' || msg.status === 'read') {
            acc[msg.campaign_id].delivered++;
        }
        if (msg.status === 'read') {
            acc[msg.campaign_id].read++;
        }
        if (msg.status === 'failed') {
            acc[msg.campaign_id].failed++;
        }
        return acc;
    }, {} as Record<string, CampaignWithMetrics['metrics']>);
    
    return campaignsData.map(campaign => ({
        ...campaign,
        metrics: metricsByCampaignId[campaign.id] || { sent: 0, delivered: 0, read: 0, failed: 0 }
    }));
};


export const fetchAllInitialData = async (userId: string) => {
    const [templatesRes, contactsRes, campaignsRes, automationsRes, pipelinesRes, stagesRes, dealsRes, customFieldsRes] = await Promise.all([
        supabase.from('message_templates').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('automations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('pipelines').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('pipeline_stages').select('*, pipelines!inner(user_id)').eq('pipelines.user_id', userId),
        supabase.from('deals').select('*, contacts(id, name)').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('custom_field_definitions').select('*').eq('user_id', userId).order('name', { ascending: true }),
    ]);

    if (templatesRes.error) console.error("DataService Error (Templates):", templatesRes.error);
    if (contactsRes.error) console.error("DataService Error (Contacts):", contactsRes.error);
    if (campaignsRes.error) console.error("DataService Error (Campaigns):", campaignsRes.error);
    if (automationsRes.error) console.error("DataService Error (Automations):", automationsRes.error);
    if (pipelinesRes.error) console.error("DataService Error (Pipelines):", pipelinesRes.error);
    if (stagesRes.error) console.error("DataService Error (Stages):", stagesRes.error);
    if (dealsRes.error) console.error("DataService Error (Deals):", dealsRes.error);
    if (customFieldsRes.error) console.error("DataService Error (CustomFields):", customFieldsRes.error);

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
        customFieldDefinitions: (customFieldsRes.data || []) as CustomFieldDefinition[],
    };
};
