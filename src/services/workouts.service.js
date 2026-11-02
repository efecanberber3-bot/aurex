import { supabase } from './supabase.js';

export async function listPrograms() {
  const { data, error } = await supabase.from('programs')
    .select('*, clients(first_name,last_name), program_exercises(*, exercise_library(name,muscle_group))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(p => ({ ...p, client_name: p.clients ? `${p.clients.first_name} ${p.clients.last_name}` : null }));
}
export async function createProgram(input) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { data, error } = await supabase.from('programs').insert({
    trainer_id: user.id,
    client_id: input.client_id,
    name: input.name.trim(),
    objective: input.objective?.trim() || null,
    start_date: input.start_date || null,
    status: 'active'
  }).select().single();
  if (error) throw error;
  return data;
}
export async function listExercises() {
  const { data, error } = await supabase.from('exercise_library').select('*').order('name');
  if (error) throw error;
  return data || [];
}
export async function addProgramExercise(input) {
  const { data, error } = await supabase.from('program_exercises').insert(input).select().single();
  if (error) throw error;
  return data;
}


export async function createExercise(input) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { data, error } = await supabase.from('exercise_library').insert({
    name: input.name.trim(),
    muscle_group: input.muscle_group?.trim() || null,
    category: input.category || 'strength',
    description: input.description?.trim() || null,
    created_by: user.id,
    is_public: false
  }).select().single();
  if (error) throw error;
  return data;
}
