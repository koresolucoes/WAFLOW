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

        console.log(`[Setup] Iniciando a configuração para o utilizador: ${userId} (${email})`);
        
        // Etapa 0: Verificar se o utilizador já possui uma equipa para tornar a função idempotente.
        const { data: existingTeam, error: checkError } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('owner_id', userId)
            .limit(1)
            .maybeSingle();

        if (checkError) {
            console.error(`[Setup] Erro ao verificar a equipa existente para o utilizador ${userId}:`, checkError);
            throw checkError;
        }

        if (existingTeam) {
            console.log(`[Setup] O utilizador ${userId} já tem uma equipa (ID: ${(existingTeam as any).id}). A garantir a adesão.`);
            // Garante que o utilizador é membro da sua própria equipa (idempotência)
            const { error: upsertError } = await supabaseAdmin
                .from('team_members')
                .upsert({ team_id: (existingTeam as any).id, user_id: userId, role: 'admin' } as any, { onConflict: 'team_id, user_id' });
            
            if (upsertError) {
                console.error(`[Setup] Erro ao fazer upsert da adesão à equipa para a equipa existente:`, upsertError);
                throw upsertError;
            }
            
            return res.status(200).json({ message: 'Configuração do utilizador confirmada: a equipa já existe.' });
        }


        // Etapa 1: Criar a equipa
        console.log(`[Setup] Nenhuma equipa encontrada para o utilizador ${userId}. A criar uma nova equipa.`);
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