
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { executeAutomation } from './_lib/engine';

// Helper function to find a profile by their Meta Phone Number ID
const findProfileByPhoneNumberId = async (phoneId: string) => {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('meta_phone_number_id', phoneId)
        .single();
    if (error) throw new Error(`Could not find profile for phone number ID ${phoneId}: ${error.message}`);
    return data;
};

// Helper function to find an existing contact or create a new one
const findOrCreateContact = async (userId: string, phone: string, name?: string) => {
    const { data: existingContact, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .eq('phone', phone)
        .single();

    if (existingContact) return existingContact;
    if (error && error.code !== 'PGRST116') throw error; // Throw if it's not a "not found" error

    const { data: newContact, error: insertError } = await supabaseAdmin
        .from('contacts')
        .insert({ user_id: userId, phone, name: name || phone })
        .select()
        .single();
    
    if (insertError) throw new Error(`Could not create contact for phone ${phone}: ${insertError.message}`);
    return newContact;
};


// Main Vercel serverless function handler
export default async function handler(req: Request) {
    if (req.method === 'GET') {
        // Handle Meta's webhook verification
        const url = new URL(req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
            return new Response(challenge, { status: 200 });
        } else {
            return new Response('Forbidden', { status: 403 });
        }
    }

    if (req.method === 'POST') {
        const body = await req.json();

        // Process incoming notifications
        try {
            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        const value = change.value;
                        
                        // Handle message status updates (e.g., delivered, read)
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                await supabaseAdmin
                                    .from('campaign_messages')
                                    .update({
                                        status: status.status,
                                        delivered_at: status.status === 'delivered' ? new Date(status.timestamp * 1000).toISOString() : null,
                                        read_at: status.status === 'read' ? new Date(status.timestamp * 1000).toISOString() : null,
                                    })
                                    .eq('meta_message_id', status.id);
                            }
                        }

                        // Handle incoming messages from users
                        if (value.messages) {
                            const profile = await findProfileByPhoneNumberId(value.metadata.phone_number_id);
                            const message = value.messages[0];
                            const contact = await findOrCreateContact(profile.id, message.from, value.contacts[0]?.profile.name);
                            
                            // Log the received message
                            await supabaseAdmin.from('received_messages').insert({
                                user_id: profile.id,
                                contact_id: contact.id,
                                meta_message_id: message.id,
                                message_body: message.text?.body || message.interactive?.button_reply?.title || 'Unsupported message type'
                            });
                            
                            // Find and trigger relevant automations
                            const { data: automations } = await supabaseAdmin.from('automations').select('*').eq('user_id', profile.id).eq('status', 'active');
                            if (automations) {
                                for(const auto of automations) {
                                    const triggerNode = auto.nodes?.find((n:any) => {
                                        const config = n.data.config as any;
                                        if (message.text?.body && n.data.type === 'message_received_with_keyword') {
                                            return message.text.body.toLowerCase().includes(config.keyword?.toLowerCase());
                                        }
                                        if (message.interactive?.button_reply && n.data.type === 'button_clicked') {
                                            return message.interactive.button_reply.id === config.button_payload;
                                        }
                                        return false;
                                    });

                                    if(triggerNode) {
                                        await executeAutomation(auto as any, contact, triggerNode.id, message);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error("Error processing webhook:", error.message);
            // Still return 200 to Meta, but log the error for debugging
        }
        
        return new Response('EVENT_RECEIVED', { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
