import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import * as teamService from '../../services/teamService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { USER_PLUS_ICON, TRASH_ICON } from '../../components/icons';
import { useUiStore } from '../../stores/uiStore';

const TeamSettings: React.FC = () => {
    const { activeTeam, user, allTeamMembers, teamLoading } = useAuthStore();
    const { showConfirmation, addToast } = useUiStore();
    const [error, setError] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState<string | null>(null);

    const members = useMemo(() => {
        if (!activeTeam) return [];
        return allTeamMembers.filter(m => m.team_id === activeTeam.id);
    }, [allTeamMembers, activeTeam]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTeam || !inviteEmail.trim()) return;
        
        setIsInviting(true);
        setError(null);
        setInviteMessage(null);
        try {
            const result = await teamService.inviteUserToTeam(activeTeam.id, inviteEmail, 'agent'); // O papel padrão é 'agent'
            setInviteMessage(result.message);
            setInviteEmail('');
            // A lista de membros não é atualizada aqui, pois o usuário precisa aceitar o convite primeiro.
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsInviting(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'agent') => {
        if (!activeTeam) return;
        try {
            await teamService.updateTeamMemberRole(activeTeam.id, userId, newRole);
            // The authStore listener should ideally handle this update via realtime
            // For now, an optimistic update would be too complex, let's rely on a page refresh or realtime.
            addToast("Função atualizada. A alteração pode levar alguns instantes para ser refletida.", 'info');
        } catch (err: any) {
            addToast(`Erro ao atualizar função: ${err.message}`, 'error');
        }
    };
    
    const handleRemoveMember = async (userId: string) => {
        if (!activeTeam) return;
        showConfirmation(
            'Remover Membro',
            "Tem certeza de que deseja remover este membro da equipe?",
            async () => {
                try {
                    await teamService.removeTeamMember(activeTeam.id, userId);
                    addToast('Membro removido com sucesso.', 'success');
                } catch (err: any) {
                    addToast(`Erro ao remover membro: ${err.message}`, 'error');
                }
            }
        );
    };

    if (!activeTeam) {
        return <Card><p className="text-center text-gray-500 dark:text-slate-400">Nenhuma equipe ativa selecionada.</p></Card>;
    }
    
    const isOwner = (memberUserId: string) => activeTeam.owner_id === memberUserId;

    const canManageTeam = useMemo(() => {
        if (!user || !activeTeam) return false;
        // The team owner always has admin rights
        if (activeTeam.owner_id === user.id) return true;
        // Also check if the user is an admin in the team_members table
        const memberInfo = members.find(m => m.user_id === user.id);
        return memberInfo?.role === 'admin';
    }, [user, activeTeam, members]);


    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Convidar Novo Membro</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Os usuários convidados receberão um e-mail para se juntarem à sua equipe.</p>
                {error && <p className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</p>}
                {inviteMessage && <p className="text-green-500 dark:text-green-400 text-sm mb-4">{inviteMessage}</p>}
                <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="w-full bg-gray-50 dark:bg-slate-700 p-2 rounded-md text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600"
                        required
                        disabled={!canManageTeam}
                    />
                    <Button type="submit" variant="primary" isLoading={isInviting} disabled={!canManageTeam}>
                        <USER_PLUS_ICON className="w-5 h-5 mr-2" />
                        Convidar
                    </Button>
                </form>
                {!canManageTeam && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Apenas proprietários ou administradores podem convidar novos membros.</p>}
            </Card>

            <Card>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Membros da Equipe ({members.length})</h2>
                {teamLoading ? <p>Carregando membros...</p> : (
                    <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                         <ul className="divide-y divide-gray-200 dark:divide-slate-700/50">
                            {members.map(member => (
                                <li key={member.user_id} className="p-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{member.email}</p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">{isOwner(member.user_id) ? 'Proprietário' : member.role === 'admin' ? 'Admin' : 'Agente'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.user_id, e.target.value as 'admin' | 'agent')}
                                            disabled={isOwner(member.user_id) || !canManageTeam}
                                            className="bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white text-xs p-1 rounded-md disabled:opacity-50 border border-gray-300 dark:border-slate-600"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="agent">Agente</option>
                                        </select>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            disabled={isOwner(member.user_id) || !canManageTeam}
                                            className="text-red-500 hover:bg-red-100/50 dark:text-red-400 dark:hover:bg-red-500/10"
                                            title={isOwner(member.user_id) ? "O proprietário não pode ser removido." : "Remover membro"}
                                        >
                                            <TRASH_ICON className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default TeamSettings;