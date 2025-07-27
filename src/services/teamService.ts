import { supabase } from '../lib/supabaseClient';
import { TeamMemberWithEmail } from '../types';

export const fetchTeamMembers = async (teamId: string): Promise<TeamMemberWithEmail[]> => {
    // Presume a existência de uma função RPC `get_team_members` que pode juntar-se a `auth.users` de forma segura.
    const { data, error } = await supabase.rpc('get_team_members', { p_team_id: teamId } as any);
    if (error) {
        console.error("Error fetching team members:", error);
        throw new Error("Não foi possível carregar os membros da equipe. Verifique se tem permissões e se a função 'get_team_members' está configurada no Supabase.");
    }
    return (data as any as TeamMemberWithEmail[]) || [];
};

export const inviteUserToTeam = async (teamId: string, email: string, role: 'admin' | 'agent'): Promise<any> => {
    // Presume a existência de uma função RPC `invite_team_member` segura no Supabase.
    const { data, error } = await supabase.rpc('invite_team_member', {
        p_team_id: teamId,
        p_email: email,
        p_role: role
    } as any);
    if (error) throw error;
    // A função RPC pode retornar um objeto de erro personalizado.
    if ((data as any).error) throw new Error((data as any).error);
    return data;
};

export const updateTeamMemberRole = async (teamId: string, userId: string, newRole: 'admin' | 'agent'): Promise<void> => {
    const { error } = await supabase
        .from('team_members')
        .update({ role: newRole } as any)
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