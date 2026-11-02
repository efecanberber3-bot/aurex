import { supabase } from './supabase.js';

export async function listClients() {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createClient(input) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const payload = {
    trainer_id: user.id,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    birth_date: input.birth_date || null,
    sport: input.sport?.trim() || null,
    goal: input.goal?.trim() || null,
    experience_level: input.experience_level || 'beginner'
  };
  const { data, error } = await supabase.from('clients').insert(payload).select().single();
  if (error) throw error;
  return data;
}
export async function updateClientStatus(id, status) {
  const { data, error } = await supabase.from('clients').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function getClient(id) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
