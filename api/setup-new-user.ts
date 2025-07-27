import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Only POST requests are allowed.' });
    }

    try {
        const { userId, email } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ message: 'Missing userId or email in request body.' });
        }

        console.log(`[Setup] Iniciando a configuração para o novo utilizador: ${userId} (${email})`);

        // Etapa 1: Criar a equipa
        const teamName = `Equipa de ${email.split('@')[0]}`;
        const { data: teamData, error: teamError } = await supabaseAdmin
            .from('teams')
            .insert({
                name: teamName,
                owner_id: userId,
            } as any)
            .select('id')
            .single();

        if (teamError) {
            console.error(`[Setup] Erro ao criar a equipa para o utilizador ${userId}:`, teamError);
            throw teamError;
        }

        const teamId = (teamData as any).id;
        console.log(`[Setup] Equipa criada com sucesso (ID: ${teamId})`);

        // Etapa 2: Adicionar o utilizador como membro administrador da equipa
        const { error: memberError } = await supabaseAdmin
            .from('team_members')
            .insert({
                team_id: teamId,
                user_id: userId,
                role: 'admin',
            } as any);

        if (memberError) {
            console.error(`[Setup] Erro ao adicionar o utilizador ${userId} à equipa ${teamId}:`, memberError);
            // Tenta reverter a criação da equipa para manter a consistência
            await supabaseAdmin.from('teams').delete().eq('id', teamId);
            throw memberError;
        }
        
        console.log(`[Setup] Utilizador ${userId} adicionado como administrador da equipa ${teamId}.`);
        console.log(`[Setup] Configuração para o novo utilizador concluída com sucesso.`);

        return res.status(200).json({ message: 'User setup complete: team and membership created.' });

    } catch (error: any) {
        console.error("[Setup] Erro na função setup-new-user:", error);
        return res.status(500).json({ message: "Failed to setup new user.", error: error.message });
    }
}
