import { supabase } from './supabase.js';

export async function getClientManagementData(clientId) {
  const [assessments, progress, goals, notes] = await Promise.all([
    supabase.from('client_assessments').select('*').eq('client_id', clientId).order('assessed_at', { ascending: false }),
    supabase.from('progress_records').select('*').eq('client_id', clientId).order('recorded_at', { ascending: false }),
    supabase.from('goals').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('coach_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  ]);
  for (const result of [assessments, progress, goals, notes]) if (result.error) throw result.error;
  return {
    assessments: assessments.data || [],
    progress: progress.data || [],
    goals: goals.data || [],
    notes: notes.data || []
  };
}

export async function saveClientAssessment(clientId, input) {
  const { data, error } = await supabase.from('client_assessments').insert({
    client_id: clientId,
    height_cm: input.height_cm ? Number(input.height_cm) : null,
    weight_kg: input.weight_kg ? Number(input.weight_kg) : null,
    fitness_notes: input.fitness_notes?.trim() || null
  }).select().single();
  if (error) throw error;

  const metrics = [
    ['waist_cm', input.waist_cm, 'cm'],
    ['body_fat_pct', input.body_fat_pct, '%'],
    ['chest_cm', input.chest_cm, 'cm'],
    ['arm_cm', input.arm_cm, 'cm'],
    ['leg_cm', input.leg_cm, 'cm']
  ].filter(([, value]) => value !== '' && value != null);

  if (metrics.length) {
    const { error: progressError } = await supabase.from('progress_records').insert(
      metrics.map(([metric_key, value, unit]) => ({
        client_id: clientId,
        metric_key,
        metric_value: Number(value),
        unit,
        visible_to_client: false
      }))
    );
    if (progressError) throw progressError;
  }
  return data;
}

export async function addClientGoal(clientId, input) {
  const { data, error } = await supabase.from('goals').insert({
    client_id: clientId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    target_date: input.target_date || null
  }).select().single();
  if (error) throw error;
  return data;
}

export async function addCoachNote(clientId, trainerId, note) {
  const { data, error } = await supabase.from('coach_notes').insert({
    client_id: clientId,
    trainer_id: trainerId,
    note: note.trim()
  }).select().single();
  if (error) throw error;
  return data;
}
