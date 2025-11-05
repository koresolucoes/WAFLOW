// api/_lib/helpers.ts
import type { VercelRequest } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export async function authorizeUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header is missing or malformed.');
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function isTeamMember(userId: string, teamId: string) {
  const { count, error } = await supabaseAdmin
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('team_id', teamId);
  if (error || count === 0) {
    return false;
  }
  return true;
}
