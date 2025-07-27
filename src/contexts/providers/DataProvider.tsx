

import React, { useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { TemplatesContext } from './TemplatesContext';
import { ContactsContext } from './ContactsContext';
import { CampaignsContext } from './CampaignsContext';
import { AutomationsContext } from './AutomationsContext';
import { FunnelContext } from './FunnelContext';
import { CustomFieldsContext } from './CustomFieldsContext';
import { fetchAllInitialData } from '../../services/dataService';
import { InboxContext } from './InboxContext';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam } = useAuthStore(state => ({ user: state.user, activeTeam: state.activeTeam }));
    const { setTemplates } = useContext(TemplatesContext);
    const { setContacts } = useContext(ContactsContext);
    const { setCampaigns } = useContext(CampaignsContext);
    const { setAutomations } = useContext(AutomationsContext);
    const { setPipelines, setStages, setDeals, setActivePipelineId } = useContext(FunnelContext);
    const { setDefinitions } = useContext(CustomFieldsContext);
    const { setConversations } = useContext(InboxContext);


    const [loading, setLoading] = useState(false);
    const [dataLoadedForTeam, setDataLoadedForTeam] = useState<string | null>(null);
    
    const fetchInitialData = useCallback(async () => {
        if (!user || !activeTeam) return;
        setLoading(true);
        
        try {
            const data = await fetchAllInitialData(activeTeam.id);
            
            if (data.templates) setTemplates(data.templates);
            if (data.contacts) setContacts(data.contacts);
            if (data.campaigns) setCampaigns(data.campaigns);
            if (data.automations) setAutomations(data.automations);
            if (data.pipelines) {
                setPipelines(data.pipelines);
                 if (data.pipelines.length > 0) {
                    // Check if the current active pipeline belongs to the new team
                    const currentPipelineStillExists = data.pipelines.some(p => p.id === useAuthStore.getState().activeTeam?.id);
                    if (!currentPipelineStillExists) {
                        setActivePipelineId(data.pipelines[0].id);
                    }
                 } else {
                    setActivePipelineId(null);
                 }
            }
            if (data.stages) setStages(data.stages);
            if (data.deals) setDeals(data.deals);
            if (data.customFieldDefinitions) setDefinitions(data.customFieldDefinitions);
            if (data.conversations) setConversations(data.conversations);

        } catch (err) {
            console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
        } finally {
            setLoading(false);
            setDataLoadedForTeam(activeTeam.id);
        }
    }, [user, activeTeam, setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setActivePipelineId, setDefinitions, setConversations]);

    const resetAllData = useCallback(() => {
        setTemplates([]);
        setContacts([]);
        setCampaigns([]);
        setAutomations([]);
        setPipelines([]);
        setStages([]);
        setDeals([]);
        setDefinitions([]);
        setConversations([]);
        setActivePipelineId(null);
        setDataLoadedForTeam(null);
    }, [setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setDefinitions, setConversations, setActivePipelineId]);


    useEffect(() => {
        if (user && activeTeam && activeTeam.id !== dataLoadedForTeam) {
            resetAllData();
            fetchInitialData();
        } else if (!user) {
            resetAllData();
        }
    }, [user, activeTeam, dataLoadedForTeam, fetchInitialData, resetAllData]);


    return <>{children}</>;
};