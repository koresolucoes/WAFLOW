import { supabase } from '../lib/supabaseClient';
import { TeamMemberWithEmail } from '../types';

export const getTeamMembersForTeams = async (teamIds: string[]): Promise<TeamMemberWithEmail[]> => {
    // Esta função presume que uma RPC `get_members_for_teams` existe por razões de segurança,
    // já que buscar e-mails de usuários diretamente do cliente não é possível/seguro.
    const { data, error } = await supabase.rpc('get_members_for_teams', { p_team_ids: teamIds });
    if (error) {
        console.error("Falha ao buscar membros da equipe via RPC:", error);
        throw error;
    };
    return (data as unknown as TeamMemberWithEmail[]) || [];
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