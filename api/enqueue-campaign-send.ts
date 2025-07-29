import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { TablesInsert } from './_lib/database.types.js';

// Helper function to calculate delay based on speed setting
const getDelayInSeconds = (speed: 'instant' | 'slow' | 'very_slow', index: number): number => {
    switch (speed) {
        case 'slow':
            return index * 60; // 1 message per minute
        case 'very_slow':
            return index * 300; // 1 message per 5 minutes
        case 'instant':
        default:
            return 0;
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    const { QSTASH_TOKEN, VERCEL_URL } = process.env;
    if (!QSTASH_TOKEN || !VERCEL_URL) {
        console.error('[ENQUEUE] Missing QSTASH_TOKEN or VERCEL_URL environment variables.');
        return res.status(500).json({ message: 'Server configuration error for queuing service.' });
    }

    try {
        const { campaignName, templateId, variables, recipients, speed, teamId, userId } = req.body;

        if (!campaignName || !templateId || !recipients || !speed || !teamId || !userId) {
            return res.status(400).json({ message: 'Missing required fields in request body.' });
        }

        // 1. Create the campaign record in the database
        const campaignPayload: TablesInsert<'campaigns'> = {
            name: campaignName,
            template_id: templateId,
            status: 'Scheduled', // Using 'Scheduled' to represent a queued/in-progress campaign
            team_id: teamId,
            recipient_count: recipients.length,
            sent_at: new Date().toISOString(), // Marks the time the queuing started
        };

        const { data: newCampaignData, error: campaignError } = await supabaseAdmin
            .from('campaigns')
            .insert(campaignPayload as any)
            .select('id')
            .single();

        if (campaignError) {
            console.error('[ENQUEUE] Error creating campaign record:', campaignError);
            throw campaignError;
        }

        const campaignId = newCampaignData.id;

        // 2. Prepare batch of messages for QStash
        const qstashUrl = `https://qstash.upstash.io/v2/batch`;
        const workerUrl = `https://${VERCEL_URL}/api/send-single-message`;
        
        const messages = recipients.map((recipient: any, index: number) => {
            const delay = getDelayInSeconds(speed, index);
            const headers: { [key: string]: string } = {
                'Content-Type': 'application/json',
            };
            if (delay > 0) {
                headers['Upstash-Delay'] = `${delay}s`;
            }

            return {
                destination: workerUrl,
                headers,
                body: JSON.stringify({
                    recipient,
                    templateId,
                    variables,
                    campaignId,
                    userId,
                }),
            };
        });

        // 3. Send the batch to QStash
        const qstashResponse = await fetch(qstashUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${QSTASH_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        if (!qstashResponse.ok) {
            const errorBody = await qstashResponse.text();
            console.error('[ENQUEUE] Failed to send batch to QStash:', errorBody);
            // Attempt to roll back the campaign creation if queuing fails
            await supabaseAdmin.from('campaigns').delete().eq('id', campaignId);
            throw new Error(`QStash failed with status ${qstashResponse.status}: ${errorBody}`);
        }

        const qstashResult = await qstashResponse.json();
        console.log(`[ENQUEUE] Successfully queued ${qstashResult.length} messages for campaign ${campaignId}.`);

        return res.status(200).json({ message: 'Campaign successfully enqueued for sending.', campaignId });

    } catch (error: any) {
        console.error("Error in enqueue-campaign-send function:", error);
        return res.status(500).json({ message: "Failed to enqueue campaign.", error: error.message });
    }
}
