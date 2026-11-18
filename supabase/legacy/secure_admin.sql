-- Script pour sécuriser l'espace admin et limiter les accès avec RLS (Row Level Security)

-- 1. Activer RLS sur les tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- 2. Lier admin_id à la table auth.users si ce n'est pas déjà fait
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'events_admin_id_fkey'
  ) THEN
    -- Assurez-vous que la colonne a le bon type
    -- ALTER TABLE public.events ALTER COLUMN admin_id TYPE uuid USING admin_id::uuid;
    ALTER TABLE public.events
    ADD CONSTRAINT events_admin_id_fkey
    FOREIGN KEY (admin_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Nettoyer les anciennes politiques très permissives (noms généralement utilisés ci-dessous)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.events;
DROP POLICY IF EXISTS "Enable update for all users" ON public.events;
DROP POLICY IF EXISTS "Enable update for anyone" ON public.events;

DROP POLICY IF EXISTS "Enable read access for all" ON public.photos;
DROP POLICY IF EXISTS "Enable insert for all" ON public.photos;
DROP POLICY IF EXISTS "Enable update for all" ON public.photos;
DROP POLICY IF EXISTS "Enable update for anyone" ON public.photos;


-- 4. Nouvelles Politiques pour `events`

-- A. Tout le monde peut LIRE (nécessaire pour afficher les pages publiques des mariages)
CREATE POLICY "Public can view events" 
ON public.events FOR SELECT USING (true);

-- B. Les utilisateurs connectés peuvent CRÉER des événements (le frontend s'assurera d'envoyer l'admin_id = auth.uid())
CREATE POLICY "Authenticated users can create events" 
ON public.events FOR INSERT TO authenticated 
WITH CHECK (true); -- Permet la création car lors de l'insert on mettra admin_id dans le payload

-- C. SEUL l'administrateur peut MODIFIER l'événement
CREATE POLICY "Admins can update their own events"
ON public.events FOR UPDATE TO authenticated
USING (auth.uid() = admin_id)
WITH CHECK (auth.uid() = admin_id);


-- 5. Nouvelles Politiques pour `photos`

-- A. Tout le monde peut LIRE les photos
CREATE POLICY "Public can view photos"
ON public.photos FOR SELECT USING (true);

-- B. Tout le monde peut AJOUTER une photo (les invités depuis la galerie uploadent)
CREATE POLICY "Public can insert photos"
ON public.photos FOR INSERT WITH CHECK (true);

-- C. SEUL l'administrateur de l'événement peut MODIFIER la photo (Modération, changer status)
CREATE POLICY "Admins can update photos of their events"
ON public.photos FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = photos.event_id
    AND events.admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = photos.event_id
    AND events.admin_id = auth.uid()
  )
);
