import { supabase } from './supabase.js';

export async function getNutritionData(clientId, date) {
  const [entries, target] = await Promise.all([
    supabase.from('nutrition_entries').select('*').eq('client_id', clientId).eq('entry_date', date).order('created_at', { ascending: true }),
    supabase.from('nutrition_targets').select('*').eq('client_id', clientId).maybeSingle()
  ]);
  if (entries.error) throw entries.error;
  if (target.error) throw target.error;
  return {
    entries: entries.data || [],
    target: target.data || { calories: 2200, protein_g: 150, carbs_g: 250, fat_g: 70, water_ml: 2500 }
  };
}

export async function saveNutritionEntry(clientId, input, id = null) {
  const payload = {
    client_id: clientId,
    entry_date: input.entry_date,
    entry_type: input.entry_type,
    meal_type: input.entry_type === 'food' ? input.meal_type : null,
    name: input.name.trim(),
    amount_g: input.entry_type === 'food' ? Number(input.amount_g) : null,
    amount_ml: input.entry_type === 'drink' ? Number(input.amount_ml) : null,
    calories: Number(input.calories || 0),
    protein_g: Number(input.protein_g || 0),
    carbs_g: Number(input.carbs_g || 0),
    fat_g: Number(input.fat_g || 0),
    notes: input.notes?.trim() || null
  };
  const query = id
    ? supabase.from('nutrition_entries').update(payload).eq('id', id).select().single()
    : supabase.from('nutrition_entries').insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteNutritionEntry(id) {
  const { error } = await supabase.from('nutrition_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function saveNutritionTarget(clientId, input) {
  const payload = {
    client_id: clientId,
    calories: Number(input.calories),
    protein_g: Number(input.protein_g),
    carbs_g: Number(input.carbs_g),
    fat_g: Number(input.fat_g),
    water_ml: Number(input.water_ml),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('nutrition_targets').upsert(payload, { onConflict: 'client_id' }).select().single();
  if (error) throw error;
  return data;
}
