import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { redis } from './_lib/redis.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { campaignId, teamId, recipientIds, templateVariables } = req.body;

        if (!campaignId || !teamId || !Array.isArray(recipientIds)) {
            return res.status(400).json({ error: 'Missing required fields: campaignId, teamId, recipientIds' });
        }

        // --- Authentication & Authorization ---
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization header is missing or malformed.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { count, error: memberError } = await supabaseAdmin
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('team_id', teamId);

        if (memberError || count === 0) {
            return res.status(403).json({ error: 'Access denied to this team.' });
        }
        // --- End Auth ---

        const jobs = recipientIds.map(contactId => JSON.stringify({
            contact_id: contactId,
            team_id: teamId,
            campaign_id: campaignId,
            template_variables: templateVariables || {},
        }));
        
        if (jobs.length > 0) {
            const queueKey = `campaign:${campaignId}`;
            const pipeline = redis.pipeline();
            // Adiciona todos os trabalhos à fila
            pipeline.lpush(queueKey, ...jobs);
            // Define um tempo de expiração para a fila, para evitar que filas órfãs permaneçam para sempre
            // Expira em 7 dias (em segundos)
            pipeline.expire(queueKey, 7 * 24 * 60 * 60); 
            await pipeline.exec();
        }
        
        return res.status(200).json({ message: 'Campaign enqueued successfully.' });

    } catch (error: any) {
        console.error('Error in enqueue-campaign function:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
