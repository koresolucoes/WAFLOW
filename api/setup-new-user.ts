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

        console.log(`[Setup] Iniciando a configuração para o usuário: ${userId} (${email})`);
        
        // Etapa 0: Verificar se o usuário já possui uma equipe para tornar a função idempotente.
        const { data: existingTeam, error: checkError } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('owner_id', userId)
            .limit(1)
            .maybeSingle();

        if (checkError) {
            console.error(`[Setup] Erro ao verificar a equipe existente para o usuário ${userId}:`, checkError);
            throw checkError;
        }

        if (existingTeam) {
            console.log(`[Setup] O usuário ${userId} já tem uma equipe (ID: ${(existingTeam as any).id}). Garantindo a adesão.`);
            // Garante que o usuário é membro da sua própria equipe (idempotência)
            const { error: upsertError } = await supabaseAdmin
                .from('team_members')
                .upsert({ team_id: (existingTeam as any).id, user_id: userId, role: 'admin' } as any, { onConflict: 'team_id, user_id' });
            
            if (upsertError) {
                console.error(`[Setup] Erro ao fazer upsert da adesão à equipe para a equipe existente:`, upsertError);
                throw upsertError;
            }
            
            return res.status(200).json({ message: 'Configuração do usuário confirmada: a equipe já existe.' });
        }


        // Etapa 1: Criar a equipe
        console.log(`[Setup] Nenhuma equipe encontrada para o usuário ${userId}. Criando uma nova equipe.`);
        const teamName = `Equipe de ${email.split('@')[0]}`;
        const { data: teamData, error: teamError } = await supabaseAdmin
            .from('teams')
            .insert({
                name: teamName,
                owner_id: userId,
            } as any)
            .select('id')
            .single();

        if (teamError) {
            console.error(`[Setup] Erro ao criar a equipe para o usuário ${userId}:`, teamError);
            throw teamError;
        }

        const teamId = (teamData as any).id;
        console.log(`[Setup] Equipe criada com sucesso (ID: ${teamId})`);

        // Etapa 2: Adicionar o usuário como membro administrador da equipe
        const { error: memberError } = await supabaseAdmin
            .from('team_members')
            .insert({
                team_id: teamId,
                user_id: userId,
                role: 'admin',
            } as any);

        if (memberError) {
            console.error(`[Setup] Erro ao adicionar o usuário ${userId} à equipe ${teamId}:`, memberError);
            // Tenta reverter a criação da equipe para manter a consistência
            await supabaseAdmin.from('teams').delete().eq('id', teamId);
            throw memberError;
        }
        
        console.log(`[Setup] Usuário ${userId} adicionado como administrador da equipe ${teamId}.`);
        console.log(`[Setup] Configuração para o novo usuário concluída com sucesso.`);

        return res.status(200).json({ message: 'User setup complete: team and membership created.' });

    } catch (error: any) {
        console.error("[Setup] Erro na função setup-new-user:", error);
        return res.status(500).json({ message: "Failed to setup new user.", error: error.message });
    }
}