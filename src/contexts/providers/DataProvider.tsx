import React, { useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AuthContext } from './AuthContext';
import { TemplatesContext } from './TemplatesContext';
import { ContactsContext } from './ContactsContext';
import { CampaignsContext } from './CampaignsContext';
import { AutomationsContext } from './AutomationsContext';
import { FunnelContext } from './FunnelContext';
import { Campaign, CampaignWithMetrics, MessageStatus, TemplateCategory, TemplateStatus, AutomationStatus, Edge, AutomationNode } from '../../types';
import { MetaTemplateComponent } from '../../services/meta/types';
import { Tables } from '../../types/database.types';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    const { setTemplates } = useContext(TemplatesContext);
    const { setContacts } = useContext(ContactsContext);
    const { setCampaigns } = useContext(CampaignsContext);
    const { setAutomations } = useContext(AutomationsContext);
    const { setPipelines, setStages, setDeals, setActivePipelineId, activePipelineId } = useContext(FunnelContext);

    const [loading, setLoading] = useState(false);
    const [dataLoadedForUser, setDataLoadedForUser] = useState<string | null>(null);
    
    const fetchCampaignsWithMetrics = useCallback(async (campaignsData: Campaign[]) => {
        const campaignsWithMetrics: CampaignWithMetrics[] = await Promise.all(
            campaignsData.map(async (campaign) => {
                const { data, error, count } = await supabase
                    .from('campaign_messages')
                    .select('status', { count: 'exact', head: false })
                    .eq('campaign_id', campaign.id);

                if (error) {
                    console.error(`Error fetching metrics for campaign ${campaign.id}:`, error);
                    return { ...campaign, recipient_count: campaign.recipient_count || 0, metrics: { sent: campaign.recipient_count || 0, delivered: 0, read: 0 } };
                }
                
                const typedData = (data as { status: MessageStatus }[]) || [];
                const delivered = typedData.filter(d => d.status === 'delivered' || d.status === 'read').length;
                const read = typedData.filter(d => d.status === 'read').length;

                return {
                    ...campaign,
                    recipient_count: campaign.recipient_count || 0,
                    metrics: { sent: count || campaign.recipient_count || 0, delivered, read }
                };
            })
        );
        setCampaigns(campaignsWithMetrics);
    }, [setCampaigns]);

    const fetchInitialData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        
        try {
            const [templatesRes, contactsRes, campaignsRes, automationsRes, pipelinesRes, stagesRes, dealsRes] = await Promise.all([
                supabase.from('message_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('contacts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('automations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('pipelines').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
                supabase.from('pipeline_stages').select('*, pipelines!inner(user_id)').eq('pipelines.user_id', user.id),
                supabase.from('deals').select('*, contacts(id, name)').eq('user_id', user.id).order('created_at', { ascending: false }),
            ]);

            if (templatesRes.data) {
                setTemplates(((templatesRes.data as Tables<'message_templates'>[]) || []).map(t => ({
                    ...t,
                    category: t.category as TemplateCategory,
                    status: t.status as TemplateStatus,
                    components: (t.components as unknown as MetaTemplateComponent[]) || [],
                } as any)));
            }

            if (contactsRes.data) setContacts(contactsRes.data as any);
            if (campaignsRes.data) await fetchCampaignsWithMetrics(campaignsRes.data as any);
            
            if (automationsRes.data){
                const automationsData = automationsRes.data as Tables<'automations'>[];
                const sanitizedAutomations = automationsData.map((a) => ({
                    ...a,
                    nodes: (Array.isArray(a.nodes) ? a.nodes : []) as AutomationNode[],
                    edges: (Array.isArray(a.edges) ? a.edges : []) as Edge[],
                    status: a.status as AutomationStatus,
                }));
                setAutomations(sanitizedAutomations as any);
            }
            
            if (pipelinesRes.data) {
                const typedPipelines = pipelinesRes.data as any[];
                setPipelines(typedPipelines);
                if (typedPipelines.length > 0 && !activePipelineId) {
                    setActivePipelineId(typedPipelines[0].id);
                }
            }
            
            if (stagesRes.data) setStages(stagesRes.data as any);
            if (dealsRes.data) setDeals(dealsRes.data as any);

        } catch (err) {
            console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
        } finally {
            setLoading(false);
            setDataLoadedForUser(user.id);
        }
    }, [user, activePipelineId, fetchCampaignsWithMetrics, setTemplates, setContacts, setAutomations, setPipelines, setStages, setDeals, setActivePipelineId]);

    useEffect(() => {
        if (user && user.id !== dataLoadedForUser) {
            // Reset states for new user
            setTemplates([]);
            setContacts([]);
            setCampaigns([]);
            setAutomations([]);
            setPipelines([]);
            setStages([]);
            setDeals([]);
            setActivePipelineId(null);
            setDataLoadedForUser(null);

            fetchInitialData();
        } else if (!user) {
            // Clear data on logout
            setTemplates([]);
            setContacts([]);
            setCampaigns([]);
            setAutomations([]);
            setPipelines([]);
            setStages([]);
            setDeals([]);
            setActivePipelineId(null);
            setDataLoadedForUser(null);
        }
    }, [user, dataLoadedForUser, fetchInitialData, setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setActivePipelineId]);


    return <>{children}</>;
};