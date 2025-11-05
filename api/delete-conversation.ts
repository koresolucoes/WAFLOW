// api/delete-conversation.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin';
import { authorizeUser, isTeamMember } from './_lib/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await authorizeUser(req);
    const { contactId } = req.query;

    if (!contactId || typeof contactId !== 'string') {
      return res.status(400).json({ error: 'contactId query parameter is required.' });
    }

    const { data: contactData, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('team_id')
      .eq('id', contactId)
      .single();

    if (contactError || !contactData) {
      return res.status(404).json({ error: 'Contact not found.' });
    }

    const teamId = contactData.team_id;

    if (!await isTeamMember(user.id, teamId)) {
      return res.status(403).json({ error: 'Access denied to this team.' });
    }

    const { error: messagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('team_id', teamId)
      .eq('contact_id', contactId);

    if (messagesError) throw messagesError;

    const { error: conversationError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('team_id', teamId)
      .eq('contact_id', contactId);

    if (conversationError) throw conversationError;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error in delete-conversation logic:', error);
    return res.status(500).json({ error: error.message });
  }
}
