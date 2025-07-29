import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try {
        const { campaignName, recipients, speed } = req.body;
        
        console.log(`[ENQUEUE] Campaign '${campaignName}' received for ${recipients.length} recipients with speed '${speed}'.`);
        console.log('[ENQUEUE] NOTE: This is a placeholder. In a real application, this endpoint would connect to a message queue service like QStash, BullMQ, or RabbitMQ.');
        console.log('[ENQUEUE] It would schedule individual calls to a worker function (e.g., /api/send-single-message) for each recipient according to the selected speed.');
        
        // Simulating success
        return res.status(200).json({ message: 'Campaign successfully enqueued for sending.' });

    } catch (error: any) {
        console.error("Error in enqueue-campaign-send function:", error);
        return res.status(500).json({ message: "Failed to enqueue campaign.", error: error.message });
    }
}
