
-- Ajout d'un mot de passe pour l'événement de démo
UPDATE public.events 
SET passcode = '1234' 
WHERE slug = 'demo-mariage';
