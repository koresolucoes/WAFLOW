
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import metaApiClient from './_lib/meta/apiClient.js';
import { Profile } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization header is missing or malformed.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('meta_access_token, meta_waba_id')
            .eq('id', user.id)
            .single();
            
        if (profileError || !profile) {
             return res.status(404).json({ error: 'Profile not found.' });
        }
        
        const { accessToken, wabaId } = {
            accessToken: profile.meta_access_token,
            wabaId: profile.meta_waba_id,
            phoneNumberId: '' // Not needed for analytics
        };
        
        if (!accessToken || !wabaId) {
            return res.status(400).json({ error: 'Meta configuration is incomplete in your profile.' });
        }

        const { start, end, granularity, type, template_ids } = req.body;
        
        if (!start || !end || !granularity || !type) {
             return res.status(400).json({ error: 'Missing required parameters: start, end, granularity, type.' });
        }
        
        let endpoint = `/${wabaId}/${type}?start=${start}&end=${end}&granularity=${granularity}`;

        if (type === 'template_analytics' && template_ids && Array.isArray(template_ids)) {
             endpoint += `&template_ids=[${template_ids.join(',')}]`;
        }

        const analyticsData = await metaApiClient({ accessToken, wabaId, phoneNumberId: '' }, endpoint, { method: 'GET' });

        return res.status(200).json({ [type]: analyticsData });

    } catch (error: any) {
        console.error('Error in meta-analytics function:', error);
        return res.status(500).json({ error: error.message });
    }
}
