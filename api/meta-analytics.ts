import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { Profile } from '../_lib/types.js';

// Helper para buscar na API da Meta com autenticação e tratamento de erros
async function fetchFromMeta<T>(accessToken: string, endpoint: string): Promise<T> {
    const API_VERSION = 'v23.0';
    const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
    const url = `${BASE_URL}${endpoint}&access_token=${accessToken}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
            console.error("Erro da API da Meta:", data.error);
            throw new Error(`Erro da Meta: ${errorMessage}`);
        }
        return data as T;
    } catch (error) {
        console.error(`Falha na chamada para o endpoint da Meta: ${endpoint}`, error);
        if (error instanceof Error) {
           throw error;
        }
        throw new Error("Ocorreu um erro desconhecido ao comunicar com a API da Meta.");
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Apenas requisições GET são permitidas' });
    }

    try {
        // 1. Autenticar usuário
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Cabeçalho de autorização ausente ou malformado.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        // 2. Obter perfil do usuário com credenciais da Meta
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('meta_access_token, meta_waba_id')
            .eq('id', user.id)
            .single();
        
        if (profileError || !profileData) {
            return res.status(404).json({ error: 'Perfil não encontrado.' });
        }
        
        const profile = profileData as unknown as Profile;

        if (!profile.meta_access_token || !profile.meta_waba_id) {
            return res.status(400).json({ error: 'Credenciais da Meta não configuradas no perfil.' });
        }

        // 3. Obter parâmetros da query
        const { start, end, granularity, type, template_ids } = req.query;
        if (!start || !end || !granularity || !type) {
             return res.status(400).json({ error: 'Parâmetros start, end, granularity e type são obrigatórios.' });
        }
        
        let endpoint = '';
        const wabaId = profile.meta_waba_id;
        const accessToken = profile.meta_access_token;

        // 4. Construir endpoint da API da Meta com base no tipo
        switch (type) {
            case 'conversation_analytics':
                endpoint = `/${wabaId}?fields=conversation_analytics.start(${start}).end(${end}).granularity(${String(granularity).toUpperCase()}).metric_types(['COST','CONVERSATION']).dimensions(['CONVERSATION_CATEGORY'])`;
                break;
            case 'template_analytics':
                 if (!template_ids || typeof template_ids !== 'string') {
                    return res.status(400).json({ error: 'Parâmetro template_ids é obrigatório para template_analytics.' });
                }
                // A granularidade para templates é sempre DAILY
                endpoint = `/${wabaId}/template_analytics?start=${start}&end=${end}&granularity=DAILY&template_ids=[${template_ids}]`;
                break;
            default:
                return res.status(400).json({ error: 'Tipo de análise inválido.' });
        }
        
        // 5. Buscar dados e retornar
        const data = await fetchFromMeta(accessToken, endpoint);
        return res.status(200).json(data);

    } catch (error: any) {
        console.error('Erro na função meta-analytics:', error);
        return res.status(500).json({ error: error.message || 'Erro interno do servidor.' });
    }
}
