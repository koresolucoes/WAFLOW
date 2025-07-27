import { supabase } from '../lib/supabaseClient';
import { TeamMemberWithEmail } from '../types';

export const getTeamMembersForTeams = async (teamIds: string[]): Promise<TeamMemberWithEmail[]> => {
    if (teamIds.length === 0) {
        return [];
    }
    // The previous RPC call was failing. Replaced with a secure serverless function.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const response = await fetch('/api/get-team-members', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ team_ids: teamIds }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Falha ao buscar membros da equipe via API:", errorData);
        throw new Error(errorData.error || 'Failed to fetch team members');
    }
    
    const data = await response.json();
    return (data as TeamMemberWithEmail[]) || [];
};

export const inviteUserToTeam = async (teamId: string, email: string, role: 'admin' | 'agent'): Promise<any> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        throw new Error("Não autenticado. Por favor, faça login novamente.");
    }

    const response = await fetch('/api/invite-member', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            team_id: teamId,
            email: email,
            role: role,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || 'Falha ao convidar membro. Verifique o console para mais detalhes.');
    }

    return result;
};

export const updateTeamMemberRole = async (teamId: string, userId: string, newRole: 'admin' | 'agent'): Promise<void> => {
    const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('team_id', teamId)
        .eq('user_id', userId);
    if (error) throw error;
};

export const removeTeamMember = async (teamId: string, userId: string): Promise<void> => {
    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);
    if (error) throw error;
};