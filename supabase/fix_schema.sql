
-- 1. Rendre la colonne 'admin_id' optionnelle (Nullable)
-- C'est nécessaire pour créer des événements de démo sans utilisateur connecté
ALTER TABLE public.events 
ALTER COLUMN admin_id DROP NOT NULL;

-- 2. Retenter l'ajout des colonnes (si elles n'ont pas été ajoutées avant l'erreur)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS passcode TEXT;

ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS uploader_id UUID;

-- 3. Insérer l'événement de démo
INSERT INTO public.events (slug, name, date)
VALUES ('demo-mariage', 'Mariage de Test & Demo', '2025-06-01');
