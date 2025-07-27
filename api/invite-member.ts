import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

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
                // We cannot get the user ID if the invite fails this way with current library limitations.
                // Return a helpful error instead of crashing.
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
            .upsert({ team_id, user_id: invitedUserId, role }, { onConflict: 'team_id, user_id' });

        if (insertError) {
            throw insertError;
        }

        return res.status(200).json({ status: 'success', message: 'Convite enviado ou membro adicionado com sucesso.' });

    } catch (error: any) {
        console.error('Erro na função de convite:', error);
        return res.status(500).json({ error: error.message });
    }
}