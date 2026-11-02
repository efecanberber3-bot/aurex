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
    is_public: true
  }).select().single();
  if (error) throw error;
  return data;
}


export async function updateProgramWithExercises(programId, input, exercises) {
  const { error: programError } = await supabase.from('programs').update({
    client_id: input.client_id,
    name: input.name.trim(),
    objective: input.objective?.trim() || null,
    start_date: input.start_date || null
  }).eq('id', programId);
  if (programError) throw programError;

  const { data: existing, error: readError } = await supabase.from('program_exercises')
    .select('id').eq('program_id', programId);
  if (readError) throw readError;

  const keepIds = exercises.filter(x => x.id).map(x => x.id);
  for (let i=0;i<exercises.length;i++) {
    const item=exercises[i];
    const exercise= item.exercise_id
      ? { id:item.exercise_id }
      : await createExercise({name:item.exercise_name,muscle_group:item.muscle_group,category:'strength'});
    const payload={
      program_id:programId, exercise_id:exercise.id,
      day_number:Number(item.day_number), order_number:i+1,
      sets:Number(item.sets), reps:item.reps.trim(),
      rest_seconds:item.rest_seconds===''?null:Number(item.rest_seconds),
      notes:item.exercise_notes?.trim()||null
    };
    const result=item.id
      ? await supabase.from('program_exercises').update(payload).eq('id',item.id)
      : await supabase.from('program_exercises').insert(payload);
    if(result.error) throw result.error;
  }
  const removed=(existing||[]).filter(x=>!keepIds.includes(x.id)).map(x=>x.id);
  if(removed.length){
    const {error}=await supabase.from('program_exercises').delete().in('id',removed);
    if(error)throw error;
  }
}

export async function deleteProgram(programId) {
  const { error } = await supabase.from('programs').delete().eq('id',programId);
  if(error) throw error;
}
