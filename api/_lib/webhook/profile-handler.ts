

import { supabaseAdmin } from '../supabaseAdmin.js';
import { Profile } from '../types.js';

export async function getProfileForWebhook(pathIdentifier: string): Promise<Profile | null> {
    console.log(`[ProfileHandler] Buscando perfil para o identificador: ${pathIdentifier}`);

    // Tentativa 1: Buscar pelo webhook_path_prefix
    const { data: profileByPrefix, error: prefixError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('webhook_path_prefix', pathIdentifier)
        .maybeSingle();

    if (prefixError) {
        console.error(`[ProfileHandler] Erro (ignorado) ao buscar pelo prefixo para '${pathIdentifier}':`, prefixError.message);
    }

    if (profileByPrefix) {
        console.log(`[ProfileHandler] Perfil encontrado com sucesso pelo prefixo.`);
        return profileByPrefix as unknown as Profile;
    }

    // Tentativa 2: Buscar pelo ID do usuário como fallback
    console.log(`[ProfileHandler] Prefixo não encontrado, tentando buscar pelo ID do usuário.`);
    const { data: profileById, error: idError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', pathIdentifier)
        .single();
        
    if (profileById) {
        console.log(`[ProfileHandler] Perfil encontrado com sucesso pelo ID.`);
        return profileById as unknown as Profile;
    }

    if (idError) {
        console.error(`[ProfileHandler] Erro final ao buscar perfil pelo ID para '${pathIdentifier}':`, idError.message);
    }

    console.error(`[ProfileHandler] Nenhum perfil encontrado para o identificador '${pathIdentifier}'.`);
    return null;
}