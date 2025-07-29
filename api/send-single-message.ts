import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try {
        const { recipient, messageContent } = req.body;

        console.log(`[WORKER] Received job to send message to ${recipient?.phone || 'unknown recipient'}.`);
        console.log(`[WORKER] Message content: ${messageContent}`);
        console.log('[WORKER] NOTE: This is a placeholder for a worker function. In a real application, this function would be called by a queue service.');
        console.log('[WORKER] It would contain the logic to send one templated message using the Meta API.');

        // Simulating a successful send
        console.log(`[WORKER] Simulated successful send to ${recipient?.phone || 'unknown recipient'}.`);
        
        return res.status(200).json({ success: true, message: `Message sent to ${recipient?.phone || 'unknown recipient'}` });

    } catch (error: any) {
        console.error("Error in send-single-message worker:", error);
        return res.status(500).json({ message: "Failed to send message.", error: error.message });
    }
}
