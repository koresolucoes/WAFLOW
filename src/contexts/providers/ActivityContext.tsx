import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ContactActivity, ContactActivityInsert, ContactActivityUpdate, TaskWithContact } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import * as activityService from '../../services/activityService';

interface ActivityContextType {
    activitiesForContact: ContactActivity[];
    todaysTasks: TaskWithContact[];
    isLoading: boolean;
    fetchActivitiesForContact: (contactId: string) => Promise<void>;
    addActivity: (activityData: Omit<ContactActivityInsert, 'team_id'>) => Promise<ContactActivity | null>;
    updateActivity: (activityId: string, updates: ContactActivityUpdate) => Promise<ContactActivity | null>;
    deleteActivity: (activityId: string) => Promise<void>;
    fetchTodaysTasks: () => Promise<void>;
}

export const ActivityContext = createContext<ActivityContextType>(null!);

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, activeTeam } = useAuthStore();
    const [activitiesForContact, setActivitiesForContact] = useState<ContactActivity[]>([]);
    const [todaysTasks, setTodaysTasks] = useState<TaskWithContact[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchTodaysTasks = useCallback(async () => {
        if (!user || !activeTeam) {
            setTodaysTasks([]);
            return;
        };
        try {
            const tasks = await activityService.fetchTodaysTasks(activeTeam.id);
            setTodaysTasks(tasks);
        } catch (error) {
            console.error("Failed to fetch today's tasks:", error);
        }
    }, [user, activeTeam]);
    
    useEffect(() => {
        if(activeTeam) {
          fetchTodaysTasks();
        }
    }, [fetchTodaysTasks, activeTeam]);

    const fetchActivitiesForContact = useCallback(async (contactId: string) => {
        if (!user || !activeTeam) return;
        setIsLoading(true);
        try {
            const activities = await activityService.fetchActivitiesForContact(activeTeam.id, contactId);
            setActivitiesForContact(activities);
        } catch (error) {
            console.error("Failed to fetch activities for contact:", error);
            setActivitiesForContact([]);
        } finally {
            setIsLoading(false);
        }
    }, [user, activeTeam]);

    const addActivity = useCallback(async (activityData: Omit<ContactActivityInsert, 'team_id'>): Promise<ContactActivity | null> => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        const newActivity = await activityService.addActivity({ ...activityData, team_id: activeTeam.id });
        if(newActivity.contact_id === (activitiesForContact[0]?.contact_id || null)) {
            setActivitiesForContact(prev => [newActivity, ...prev]);
        }
        if (newActivity.type === 'TAREFA') {
            fetchTodaysTasks(); // Refresh dashboard tasks
        }
        return newActivity;
    }, [user, activeTeam, activitiesForContact, fetchTodaysTasks]);

    const updateActivity = useCallback(async (activityId: string, updates: ContactActivityUpdate): Promise<ContactActivity | null> => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        const updatedActivity = await activityService.updateActivity(activityId, activeTeam.id, updates);
        setActivitiesForContact(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
        fetchTodaysTasks(); // Refresh dashboard tasks
        return updatedActivity;
    }, [user, activeTeam, fetchTodaysTasks]);
    
    const deleteActivity = useCallback(async (activityId: string) => {
        if (!user || !activeTeam) throw new Error("User or active team not available.");
        await activityService.deleteActivity(activityId, activeTeam.id);
        setActivitiesForContact(prev => prev.filter(a => a.id !== activityId));
        fetchTodaysTasks(); // Refresh dashboard tasks
    }, [user, activeTeam, fetchTodaysTasks]);

    const value = {
        activitiesForContact,
        todaysTasks,
        isLoading,
        fetchActivitiesForContact,
        addActivity,
        updateActivity,
        deleteActivity,
        fetchTodaysTasks,
    };

    return (
        <ActivityContext.Provider value={value}>
            {children}
        </ActivityContext.Provider>
    );
};