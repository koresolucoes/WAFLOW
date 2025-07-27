import React, { useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { TemplatesContext } from './TemplatesContext';
import { ContactsContext } from './ContactsContext';
import { CampaignsContext } from './CampaignsContext';
import { AutomationsContext } from './AutomationsContext';
import { FunnelContext } from './FunnelContext';
import { CustomFieldsContext } from './CustomFieldsContext';
import { CannedResponsesContext } from './CannedResponsesContext';
import { fetchAllInitialData } from '../../services/dataService';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam } = useAuthStore();
    const { setTemplates } = useContext(TemplatesContext);
    const { setContacts } = useContext(ContactsContext);
    const { setCampaigns } = useContext(CampaignsContext);
    const { setAutomations } = useContext(AutomationsContext);
    const { setPipelines, setStages, setDeals, setActivePipelineId } = useContext(FunnelContext);
    const { setDefinitions } = useContext(CustomFieldsContext);
    const { setResponses } = useContext(CannedResponsesContext);

    const [loading, setLoading] = useState(false);
    const [dataLoadedForTeam, setDataLoadedForTeam] = useState<string | null>(null);
    const currentTeamIdRef = useRef<string | null>(null);

    const clearAllData = useCallback(() => {
        setTemplates([]);
        setContacts([]);
        setCampaigns([]);
        setAutomations([]);
        setPipelines([]);
        setStages([]);
        setDeals([]);
        setDefinitions([]);
        setResponses([]);
        setActivePipelineId(null);
    }, [setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setDefinitions, setResponses, setActivePipelineId]);
    
    const fetchInitialData = useCallback(async (teamId: string) => {
        if (!user || !teamId) return;
        setLoading(true);
        setDataLoadedForTeam(null);
        
        try {
            const data = await fetchAllInitialData(teamId);
            
            // Ensure we only set data for the currently active team
            if (teamId === currentTeamIdRef.current) {
                if (data.templates) setTemplates(data.templates);
                if (data.contacts) setContacts(data.contacts);
                if (data.campaigns) setCampaigns(data.campaigns);
                if (data.automations) setAutomations(data.automations);
                if (data.pipelines) {
                    setPipelines(data.pipelines);
                    if (data.pipelines.length > 0) {
                        setActivePipelineId(data.pipelines[0].id);
                    } else {
                        setActivePipelineId(null);
                    }
                }
                if (data.stages) setStages(data.stages);
                if (data.deals) setDeals(data.deals);
                if (data.customFieldDefinitions) setDefinitions(data.customFieldDefinitions);
                if (data.cannedResponses) setResponses(data.cannedResponses);

                setDataLoadedForTeam(teamId);
            }

        } catch (err) {
            console.error("A critical error occurred during initial data fetch:", (err as any).message || err);
        } finally {
             if (teamId === currentTeamIdRef.current) {
                setLoading(false);
            }
        }
    }, [user, setTemplates, setContacts, setCampaigns, setAutomations, setPipelines, setStages, setDeals, setActivePipelineId, setDefinitions, setResponses]);

    useEffect(() => {
        if (!user) {
            clearAllData();
            setDataLoadedForTeam(null);
        }
    }, [user, clearAllData]);

    useEffect(() => {
        currentTeamIdRef.current = activeTeam?.id || null;
        if (activeTeam && activeTeam.id !== dataLoadedForTeam) {
            console.log(`Team changed to ${activeTeam.name}. Fetching new data.`);
            clearAllData();
            fetchInitialData(activeTeam.id);
        }
    }, [activeTeam, dataLoadedForTeam, fetchInitialData, clearAllData]);


    return <>{children}</>;
};
