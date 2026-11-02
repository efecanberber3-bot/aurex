-- Optional starter exercise catalogue.
-- Run after the migration while signed in as a trainer,
-- or change created_by to the trainer's auth UUID.
insert into public.exercise_library
  (name, muscle_group, category, description, is_public)
values
  ('Goblet Squat','Lower body','Strength','Kontrollü squat varyasyonu.',true),
  ('Dumbbell Romanian Deadlift','Posterior chain','Strength','Kalça menteşesi ve arka zincir.',true),
  ('Glute Bridge','Glutes','Activation','Kalça aktivasyonu.',true),
  ('Seated Cable Row','Back','Strength','Yatay çekiş hareketi.',true),
  ('Machine Chest Press','Chest','Strength','Makine göğüs press.',true),
  ('Pallof Press','Core','Stability','Anti-rotasyon gövde çalışması.',true),
  ('Dead Bug','Core','Stability','Gövde kontrolü.',true),
  ('Stationary Bike','Cardio','Conditioning','Düşük darbeli kardiyo.',true),
  ('Leg Press','Lower body','Strength','Makine bacak press.',true),
  ('Seated Leg Curl','Hamstrings','Strength','Arka bacak makinesi.',true)
on conflict do nothing;
