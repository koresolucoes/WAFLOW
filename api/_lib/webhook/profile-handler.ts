
import { supabaseAdmin } from '../supabaseAdmin.js';
import { Profile, TablesInsert } from '../types.js';

export async function getProfileForWebhook(userId: string): Promise<Profile | null> {
    let { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select()
        .eq('id', userId)
        .single();

    if (profileError && profileError.code === 'PGRST116') {
        console.warn(`[Manipulador de Perfil] Perfil não encontrado para o usuário ${userId}. Verificando usuário de autenticação e tentando criar um perfil.`);
        
        const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (authUserError || !authUserData.user) {
            console.error(`[Manipulador de Perfil] CRÍTICO: Usuário de autenticação não encontrado para user_id: ${userId}. A URL do webhook pode estar incorreta ou o usuário pode ter sido excluído.`);
            return null;
        }

        const newProfilePayload: TablesInsert<'profiles'> = { 
            id: userId, 
            company_name: `Empresa de ${authUserData.user.email || 'Usuário'}`
        };
        const { data: newProfile, error: newProfileError } = await supabaseAdmin
            .from('profiles')
            .insert(newProfilePayload as any)
            .select()
            .single();
            
        if (newProfileError || !newProfile) {
            console.error(`[Manipulador de Perfil] CRÍTICO: Falha ao criar um perfil padrão para o usuário ${userId}.`, newProfileError);
            return null;
        }

        profileData = newProfile;
        console.log(`[Manipulador de Perfil] Perfil padrão criado com sucesso para o usuário ${userId}.`);
    } else if (profileError) {
        console.error(`[Manipulador de Perfil] CRÍTICO: Erro de banco de dados ao buscar perfil para o usuário ${userId}.`, profileError);
        return null;
    }
    
    return profileData as unknown as Profile;
}