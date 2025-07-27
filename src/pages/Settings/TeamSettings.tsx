
import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { supabase } from '../../lib/supabaseClient';

const TeamSettings: React.FC = () => {
    const { activeTeam, user } = useAuthStore();
    const [inviteEmail, setInviteEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Placeholder for team members - in a real app, this would be fetched
    const [members, setMembers] = useState([
        { id: user?.id, email: user?.email, role: 'admin' }
    ]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !activeTeam) return;

        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            // This requires an RLS policy allowing admins to insert into team_members
            // and potentially a server-side function to handle the invitation flow.
            // For now, we simulate the client-side part of the invitation.
            const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
                inviteEmail,
                { data: { team_id_to_join: activeTeam.id, role: 'agent' } }
            );

            if (inviteError) throw inviteError;
            
            setMessage(`Convite enviado para ${inviteEmail}. O utilizador precisa de aceitar o convite para se juntar à equipa.`);
            setInviteEmail('');

        } catch (err: any) {
            setError(err.message || 'Falha ao enviar convite.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Gerir Membros da Equipa</h2>
                <div className="bg-slate-900/50 rounded-lg divide-y divide-slate-700/50">
                    {members.map(member => (
                        <div key={member.id} className="p-3 flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white">{member.email}</p>
                                <p className="text-xs text-slate-400 capitalize">{member.role}</p>
                            </div>
                            {/* Placeholder for role changing/removing */}
                            <Button variant="secondary" size="sm" disabled>Gerir</Button>
                        </div>
                    ))}
                </div>
            </Card>

            <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Convidar Novo Membro</h2>
                {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
                {message && <p className="text-green-400 text-sm mb-2">{message}</p>}
                <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="w-full bg-slate-700 p-2 rounded-md text-white"
                        required
                    />
                    <Button type="submit" variant="primary" isLoading={isLoading}>Convidar</Button>
                </form>
            </Card>
        </div>
    );
};

export default TeamSettings;
