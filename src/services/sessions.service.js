import { supabase } from './supabase.js';

export async function listSessions() {
  const { data, error } = await supabase.from('training_sessions')
    .select('*, clients(first_name,last_name)')
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(s => ({ ...s, client_name: s.clients ? `${s.clients.first_name} ${s.clients.last_name}` : null }));
}
export async function createSession(input) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { data, error } = await supabase.from('training_sessions').insert({
    trainer_id: user.id,
    client_id: input.client_id,
    scheduled_at: new Date(input.scheduled_at).toISOString(),
    duration_minutes: Number(input.duration_minutes) || 60,
    status: 'planned'
  }).select().single();
  if (error) throw error;
  return data;
}
