import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import type { User } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    
    // Route to FETCH members (logic from old get-team-members.ts)
    if (req.method === 'GET') {
        try {
            const { team_ids: teamIdsQuery } = req.query;

            if (!teamIdsQuery || typeof teamIdsQuery !== 'string') {
                return res.status(400).json({ error: 'Missing team_ids query parameter.' });
            }
            const team_ids = teamIdsQuery.split(',');

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Authorization header is missing or malformed.' });
            }
            const token = authHeader.split(' ')[1];
            const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

            if (userError || !user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            const { count, error: membershipError } = await supabaseAdmin
                .from('team_members')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('team_id', team_ids);
            
            if (membershipError) throw membershipError;

            if (count !== team_ids.length) {
                return res.status(403).json({ error: 'Access denied to one or more teams.' });
            }

            const { data: members, error: membersError } = await supabaseAdmin
                .from('team_members')
                .select('team_id, user_id, role')
                .in('team_id', team_ids);

            if (membersError) throw membersError;

            if (!members || members.length === 0) {
                return res.status(200).json([]);
            }

            const userIds = [...new Set(members.map(m => m.user_id))];

            const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
                 page: 1,
                 perPage: 1000,
            });

            if (usersError) throw usersError;
            
            const relevantUsers = usersData.users.filter((u: User) => userIds.includes(u.id));
            const usersById = new Map(relevantUsers.map((u: User) => [u.id, u]));
            
            const result = members.map(member => ({
                team_id: member.team_id as string,
                user_id: member.user_id as string,
                role: member.role as 'admin' | 'agent',
                email: (usersById.get(member.user_id) as User | undefined)?.email || 'Email não encontrado'
            }));
            
            return res.status(200).json(result);

        } catch (error: any) {
            console.error('Error in get-team-members logic:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Route to INVITE a new member (logic from old invite-member.ts)
    if (req.method === 'POST') {
        try {
            const { team_id, email, role } = req.body;

            if (!team_id || !email || !role) {
                return res.status(400).json({ error: 'Missing team_id, email, or role in request body.' });
            }

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Authorization header is missing or malformed.' });
            }
            const token = authHeader.split(' ')[1];
            const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

            if (userError || !user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            const { data: teamOwnerData, error: ownerError } = await supabaseAdmin
                .from('teams')
                .select('owner_id')
                .eq('id', team_id)
                .single();

            if (ownerError) throw ownerError;
            if (!teamOwnerData) {
                return res.status(404).json({ error: 'Team not found.' });
            }

            let isOwner = teamOwnerData.owner_id === user.id;
            let isAdmin = false;

            if (!isOwner) {
                const { data: member, error: memberError } = await supabaseAdmin
                    .from('team_members')
                    .select('role')
                    .eq('team_id', team_id)
                    .eq('user_id', user.id)
                    .single();

                if (memberError && memberError.code !== 'PGRST116') {
                     throw memberError;
                }
                isAdmin = member?.role === 'admin';
            }
            
            if (!isOwner && !isAdmin) {
                 return res.status(403).json({ error: 'Apenas proprietários ou administradores da equipe podem convidar novos membros.' });
            }

            const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
            
            if (inviteError) {
                if (inviteError.message.includes('User already registered')) {
                    return res.status(409).json({ error: 'Este usuário já está registrado. A funcionalidade para adicionar membros existentes será aprimorada em breve.' });
                }
                throw inviteError;
            }

            const invitedUserId = inviteData?.user?.id;

            if (!invitedUserId) {
                 return res.status(500).json({ error: 'Não foi possível encontrar ou criar o utilizador convidado.' });
            }

            const { error: insertError } = await supabaseAdmin
                .from('team_members')
                .upsert({ team_id, user_id: invitedUserId, role } as any, { onConflict: 'team_id, user_id' });

            if (insertError) {
                throw insertError;
            }

            return res.status(200).json({ status: 'success', message: 'Convite enviado ou membro adicionado com sucesso.' });

        } catch (error: any) {
            console.error('Error in invite-member logic:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
