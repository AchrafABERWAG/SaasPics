
-- 1. Créer le bucket de stockage 'photos' (si ce n'est pas déjà fait)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politique de sécurité pour le STORAGE (Fichiers)
-- IMPORTANT : Il faut autoriser l'upload (INSERT) et la lecture (SELECT)

-- Autoriser tout le monde à voir les photos (Public)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'photos' );

-- Autoriser tout le monde à uploader (Upload)
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'photos' );
