import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import type { User } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { team_ids } = req.body;

        if (!team_ids || !Array.isArray(team_ids) || team_ids.length === 0) {
            return res.status(400).json({ error: 'Missing team_ids array in request body.' });
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
        console.error('Error in get-team-members function:', error);
        return res.status(500).json({ error: error.message });
    }
}