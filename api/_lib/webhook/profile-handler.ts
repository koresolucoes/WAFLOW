
import { supabaseAdmin } from '../supabaseAdmin.js';
import { Profile } from '../types.js';

export async function getProfileForWebhook(userId: string): Promise<Profile | null> {
    console.log(`[ProfileHandler] Buscando perfil para o usuário com ID: ${userId}`);

    const { data: profileData, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error(`[ProfileHandler] Erro ao buscar perfil para o usuário ${userId}:`, error);
        // Retorna nulo para que o chamador possa lidar com a falha
        return null; 
    }

    if (!profileData) {
        console.error(`[ProfileHandler] Nenhum perfil encontrado para o usuário ${userId}.`);
        return null;
    }
    
    console.log(`[ProfileHandler] Perfil encontrado com sucesso para o usuário ${userId}.`);
    return profileData as unknown as Profile;
}
