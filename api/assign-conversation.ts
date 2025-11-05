// api/assign-conversation.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin';
import { authorizeUser, isTeamMember } from './_lib/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await authorizeUser(req);
    const { contactId, assigneeId } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required.' });
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

    const { error: upsertError } = await supabaseAdmin
      .from('conversations')
      .upsert(
        {
          team_id: teamId,
          contact_id: contactId,
          assignee_id: assigneeId,
          status: 'open',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id, contact_id' }
      );

    if (upsertError) throw upsertError;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error in assign-conversation logic:', error);
    return res.status(500).json({ error: error.message });
  }
}
