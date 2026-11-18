
-- 1. Autoriser la suppression dans la Base de Données (Table photos)
-- Par défaut, Supabase bloque les suppressions. On doit les autoriser explicitement.
CREATE POLICY "Enable delete for all" 
ON public.photos 
FOR DELETE 
USING (true); 
-- Note : Dans une vraie app prod, on vérifierait auth.uid() = event.owner_id
-- Mais ici pour le MVP avec passcode client, on ouvre la suppression.

-- 2. Autoriser la suppression dans le Stockage (Storage)
-- Indispensable pour que le bouton "Supprimer" retire aussi le fichier image.
CREATE POLICY "Enable delete for storage" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'photos');
