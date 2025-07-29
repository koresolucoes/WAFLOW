import { supabase } from '../lib/supabaseClient';
import { Campaign, CampaignWithMetrics, MessageStatus, TemplateCategory, TemplateStatus, AutomationStatus, Edge, AutomationNode, Contact, MessageTemplate, Automation, Pipeline, PipelineStage, DealWithContact, CustomFieldDefinition, CannedResponse } from '../types';
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

    const metricsByCampaignId = (data as any[]).reduce((acc, msg) => {
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


export const fetchAllInitialData = async (teamId: string) => {
    const [templatesRes, contactsRes, campaignsRes, automationsRes, pipelinesRes, stagesRes, dealsRes, customFieldsRes, cannedResponsesRes] = await Promise.all([
        supabase.from('message_templates').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('contacts').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('automations').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('pipelines').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
        supabase.from('pipeline_stages').select('*, pipelines!inner(team_id)').eq('pipelines.team_id', teamId),
        supabase.from('deals').select('*, contacts(id, name)').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('custom_field_definitions').select('*').eq('team_id', teamId).order('name', { ascending: true }),
        supabase.from('canned_responses').select('*').eq('team_id', teamId).order('shortcut', { ascending: true }),
    ]);

    if (templatesRes.error) console.error("DataService Error (Templates):", templatesRes.error);
    if (contactsRes.error) console.error("DataService Error (Contacts):", contactsRes.error);
    if (campaignsRes.error) console.error("DataService Error (Campaigns):", campaignsRes.error);
    if (automationsRes.error) console.error("DataService Error (Automations):", automationsRes.error);
    if (pipelinesRes.error) console.error("DataService Error (Pipelines):", pipelinesRes.error);
    if (stagesRes.error) console.error("DataService Error (Stages):", stagesRes.error);
    if (dealsRes.error) console.error("DataService Error (Deals):", dealsRes.error);
    if (customFieldsRes.error) console.error("DataService Error (CustomFields):", customFieldsRes.error);
    if (cannedResponsesRes.error) console.error("DataService Error (CannedResponses):", cannedResponsesRes.error);

    // Process Templates
    const templates = ((templatesRes.data as any[]) || []).map(t => ({
        ...t,
        category: t.category as TemplateCategory,
        status: t.status as TemplateStatus,
        components: (t.components as unknown as MetaTemplateComponent[]) || [],
    } as MessageTemplate));
    
    // Process Automations
    const automationsData = (automationsRes.data as any[]) || [];
    const automations = automationsData.map((a) => ({
        ...a,
        nodes: (Array.isArray(a.nodes) ? a.nodes : []) as unknown as AutomationNode[],
        edges: (Array.isArray(a.edges) ? a.edges : []) as unknown as Edge[],
        status: a.status as AutomationStatus,
    } as Automation));
    
    // Process Campaigns
    const campaigns = await fetchCampaignsWithMetrics((campaignsRes.data as unknown as Campaign[]) || []);

    return {
        templates,
        contacts: (contactsRes.data as unknown as Contact[]) || [],
        campaigns,
        automations,
        pipelines: (pipelinesRes.data as unknown as Pipeline[]) || [],
        stages: (stagesRes.data as unknown as PipelineStage[]) || [],
        deals: (dealsRes.data as unknown as DealWithContact[]) || [],
        definitions: (customFieldsRes.data as unknown as CustomFieldDefinition[]) || [],
        responses: (cannedResponsesRes.data as unknown as CannedResponse[]) || [],
    };
};


// Tipos para os novos dados do dashboard
export type AutomationRunStat = {
    automation_id: string;
    automations: { name: string } | null;
    count: number;
};

export type GlobalActivityEvent = {
  id: string;
  type: 'NEW_CONTACT' | 'CAMPAIGN_SENT' | 'DEAL_WON' | 'DEAL_LOST';
  timestamp: string;
  title: string;
  description: string;
  value?: number;
};

export type DashboardData = {
    totalRunsLast7Days: number;
    successfulRunsLast7Days: number;
    mostActiveAutomations: AutomationRunStat[];
    activityFeed: GlobalActivityEvent[];
};

// Nova função para buscar dados agregados para o dashboard
export const fetchDashboardData = async (teamId: string): Promise<DashboardData> => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Busca agregada de execuções de automação
    const [automationRunsRes, contactsRes, campaignsRes, dealsRes] = await Promise.all([
        supabase.from('automation_runs').select('id, status, automation_id, automations!inner(name, team_id)', { count: 'exact' }).eq('automations.team_id', teamId).gte('run_at', sevenDaysAgo.toISOString()),
        supabase.from('contacts').select('id, name, created_at').eq('team_id', teamId).order('created_at', { ascending: false }).limit(10),
        supabase.from('campaigns').select('id, name, sent_at').eq('team_id', teamId).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(10),
        supabase.from('deals').select('id, name, value, closed_at, status').eq('team_id', teamId).in('status', ['Ganho', 'Perdido']).not('closed_at', 'is', null).order('closed_at', { ascending: false }).limit(10),
    ]);

    if (automationRunsRes.error) console.error("Dashboard Data Error (Automation Runs):", automationRunsRes.error);
    if (contactsRes.error) console.error("Dashboard Data Error (Contacts):", contactsRes.error);
    if (campaignsRes.error) console.error("Dashboard Data Error (Campaigns):", campaignsRes.error);
    if (dealsRes.error) console.error("Dashboard Data Error (Deals):", dealsRes.error);

    const automationRuns = (automationRunsRes.data as any[]) || [];
    const totalRunsLast7Days = automationRuns.length;
    const successfulRunsLast7Days = automationRuns.filter(r => r.status === 'success').length;

    // Agrupar e contar execuções por automação
    const runsByAutomation = automationRuns.reduce((acc, run) => {
        if (run.automation_id) {
            acc[run.automation_id] = (acc[run.automation_id] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const mostActiveAutomations: AutomationRunStat[] = Object.entries(runsByAutomation)
        .map(([automation_id, count]) => {
            const run = automationRuns.find(r => r.automation_id === automation_id);
            return {
                automation_id,
                count: count as number,
                automations: run?.automations || { name: 'Automação Desconhecida' }
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    
    // Montar o feed de atividades
    const contactsEvents: GlobalActivityEvent[] = ((contactsRes.data as any[]) || []).map(c => ({
        id: `contact-${c.id}`, type: 'NEW_CONTACT', timestamp: c.created_at,
        title: 'Novo Contato', description: c.name,
    }));
    const campaignsEvents: GlobalActivityEvent[] = ((campaignsRes.data as any[]) || []).map(c => ({
        id: `campaign-${c.id}`, type: 'CAMPAIGN_SENT', timestamp: c.sent_at!,
        title: 'Campanha Enviada', description: c.name,
    }));
    const dealsEvents: GlobalActivityEvent[] = ((dealsRes.data as any[]) || []).map(d => ({
        id: `deal-${d.id}`,
        type: d.status === 'Ganho' ? 'DEAL_WON' : 'DEAL_LOST',
        timestamp: d.closed_at!,
        title: d.status === 'Ganho' ? 'Negócio Ganho' : 'Negócio Perdido',
        description: d.name,
        value: d.value || 0,
    }));
    
    const activityFeed = [...contactsEvents, ...campaignsEvents, ...dealsEvents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15);

    return {
        totalRunsLast7Days,
        successfulRunsLast7Days,
        mostActiveAutomations,
        activityFeed,
    };
};
