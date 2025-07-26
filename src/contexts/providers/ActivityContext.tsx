import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ContactActivity, ContactActivityInsert, ContactActivityUpdate, TaskWithContact } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import * as activityService from '../../services/activityService';

interface ActivityContextType {
    activitiesForContact: ContactActivity[];
    todaysTasks: TaskWithContact[];
    isLoading: boolean;
    fetchActivitiesForContact: (contactId: string) => Promise<void>;
    addActivity: (activityData: ContactActivityInsert) => Promise<ContactActivity | null>;
    updateActivity: (activityId: string, updates: ContactActivityUpdate) => Promise<ContactActivity | null>;
    deleteActivity: (activityId: string) => Promise<void>;
}

export const ActivityContext = createContext<ActivityContextType>(null!);

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const user = useAuthStore(state => state.user);
    const [activitiesForContact, setActivitiesForContact] = useState<ContactActivity[]>([]);
    const [todaysTasks, setTodaysTasks] = useState<TaskWithContact[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchTodaysTasks = useCallback(async () => {
        if (!user) return;
        try {
            const tasks = await activityService.fetchTodaysTasks(user.id);
            setTodaysTasks(tasks);
        } catch (error) {
            console.error("Failed to fetch today's tasks:", error);
        }
    }, [user]);
    
    useEffect(() => {
        fetchTodaysTasks();
    }, [fetchTodaysTasks]);

    const fetchActivitiesForContact = useCallback(async (contactId: string) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const activities = await activityService.fetchActivitiesForContact(user.id, contactId);
            setActivitiesForContact(activities);
        } catch (error) {
            console.error("Failed to fetch activities for contact:", error);
            setActivitiesForContact([]);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const addActivity = useCallback(async (activityData: ContactActivityInsert): Promise<ContactActivity | null> => {
        if (!user) throw new Error("User not authenticated.");
        const newActivity = await activityService.addActivity({ ...activityData, user_id: user.id });
        if(newActivity.contact_id === (activitiesForContact[0]?.contact_id || null)) {
            setActivitiesForContact(prev => [newActivity, ...prev]);
        }
        if (newActivity.type === 'TAREFA') {
            fetchTodaysTasks(); // Refresh dashboard tasks
        }
        return newActivity;
    }, [user, activitiesForContact, fetchTodaysTasks]);

    const updateActivity = useCallback(async (activityId: string, updates: ContactActivityUpdate): Promise<ContactActivity | null> => {
        const updatedActivity = await activityService.updateActivity(activityId, updates);
        setActivitiesForContact(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
        fetchTodaysTasks(); // Refresh dashboard tasks
        return updatedActivity;
    }, [fetchTodaysTasks]);
    
    const deleteActivity = useCallback(async (activityId: string) => {
        await activityService.deleteActivity(activityId);
        setActivitiesForContact(prev => prev.filter(a => a.id !== activityId));
        fetchTodaysTasks(); // Refresh dashboard tasks
    }, [fetchTodaysTasks]);

    const value = {
        activitiesForContact,
        todaysTasks,
        isLoading,
        fetchActivitiesForContact,
        addActivity,
        updateActivity,
        deleteActivity
    };

    return (
        <ActivityContext.Provider value={value}>
            {children}
        </ActivityContext.Provider>
    );
};
