-- Household detail categories. These are global lookup rows only: no user
-- data or historical movement is changed by this migration.
INSERT INTO public.categories (label, icon, color, sort_order) VALUES
  ('Calefacción / Parafina', '♨️', '#C96C4B', 30),
  ('Almacén de barrio', '🧺', '#8FB996', 31),
  ('Feria', '🥬', '#77A65A', 32),
  ('Hobby / Coleccionables', '🃏', '#8064C8', 33),
  ('Mascotas · Molly', '🐾', '#B16C7A', 34),
  ('Mascotas · Terry', '🐾', '#6B8E78', 35)
ON CONFLICT DO NOTHING;
