-- =============================================================================
-- 0007 — Seed: ANZSCO occupation codes (skilled trades subset)
-- Idempotent: safe to re-run.
-- =============================================================================
insert into public.occupation_codes (code, title, skill_level, category, aliases)
values
  ('331111', 'Bricklayer',                 3, 'Construction Trades', array['brickie','mason']),
  ('331212', 'Carpenter',                  3, 'Construction Trades', array['joiner','chippy']),
  ('334111', 'Plumber',                    3, 'Construction Trades', array['plumber','gasfitter']),
  ('341111', 'Electrician (General)',      3, 'Electrotechnology',  array['electrician','sparky']),
  ('351311', 'Chef',                       2, 'Food Trades',        array['chef','cook']),
  ('321211', 'Motor Mechanic (General)',   3, 'Automotive',         array['mechanic']),
  ('322211', 'Sheetmetal Trades Worker',   3, 'Engineering Trades', array['sheetmetal worker']),
  ('322311', 'Metal Fabricator',           3, 'Engineering Trades', array['fabricator','boilermaker']),
  ('333211', 'Fibrous Plasterer',          3, 'Construction Trades', array['plasterer']),
  ('333411', 'Wall and Floor Tiler',       3, 'Construction Trades', array['tiler']),
  ('342311', 'Air-conditioning and Refrigeration Mechanic', 3, 'Electrotechnology', array['HVAC technician','refrigeration mechanic']),
  ('323211', 'Fitter (General)',           3, 'Engineering Trades', array['fitter and turner']),
  ('351411', 'Baker',                      3, 'Food Trades',        array['baker']),
  ('394111', 'Cabinetmaker',               3, 'Wood Trades',        array['cabinet maker']),
  ('333111', 'Glazier',                    3, 'Construction Trades', array['glazier'])
on conflict (code) do nothing;
