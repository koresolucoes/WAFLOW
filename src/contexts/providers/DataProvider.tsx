

import React, { useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { TemplatesContext } from './TemplatesContext';
import { ContactsContext } from './ContactsContext';
import { CampaignsContext } from './CampaignsContext';
import { AutomationsContext } from './AutomationsContext';
import { FunnelContext } from './FunnelContext';
import { CustomFieldsContext } from './CustomFieldsContext';
import { fetchAllInitialData } from '../../services/dataService';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const user = useAuthStore(state => state.user);
    const { setTemplates } = useContext(TemplatesContext);
    const { setContacts } = useContext(ContactsContext);
    const { setCampaigns } = useContext(CampaignsContext);
    const { setAutomations } = useContext(AutomationsContext);
    const { setPipelines, setStages, setDeals, setActivePipelineId, activePipelineId } = useContext(FunnelContext);
    const { setDefinitions } = useContext(CustomFieldsContext);

    const [loading, setLoading] = useState(false);
    const [dataLoadedForUser, setDataLoadedForUser] = useState<string | null>(null);
    
    const fetchInitialData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        
        try {
            const data = await fetchAllInitialData(user.id);
            
            if (data.templates) setTemplates(data.templates);
            if (data.contacts) setContacts(data.contacts);
            if (data.campaigns) setCampaigns(data.campaigns);
            if (data.automations) setAutomations(data.automations);
            if (data.pipelines) {
                setPipelines(data.pipelines);
                 if (data.pipelines.length > 0 && !activePipelineId) {
                    setActivePipelineId(data.pipelines[0].id);
                }
            }
            if (data.stages) setStages(data.stages);
            if (data.deals) setDeals(data.deals);
            if (data.customFieldDefinitions) setDefinitions(data.customFieldDefinitions);

        } catch (err) {
            console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
        } finally {
            setLoading(false);
            setDataLoadedForUser(user.id);
        }
    }, [user, activePipelineId, setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setActivePipelineId, setDefinitions]);

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
            setDefinitions([]);
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
            setDefinitions([]);
            setActivePipelineId(null);
            setDataLoadedForUser(null);
        }
    }, [user, dataLoadedForUser, fetchInitialData, setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setActivePipelineId, setDefinitions]);


    return <>{children}</>;
};