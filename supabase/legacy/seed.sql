
-- Insère un événement de démo pour tester
INSERT INTO public.events (slug, name, date)
VALUES
  ('demo-mariage', 'Mariage de Test & Demo', CURRENT_DATE);

-- Optionnel : Si tu veux vérifier que ça a marché
-- SELECT * FROM public.events WHERE slug = 'demo-mariage';
