
-- Le problème est que ta table contient une colonne "url" obligatoire (Not Null).
-- Mon code utilise "storage_path" et génère l'URL dynamiquement (plus sécurisé).

-- Solution : On rend la colonne "url" optionnelle.
ALTER TABLE public.photos 
ALTER COLUMN url DROP NOT NULL;

-- Optionnel : Si tu as une colonne "guest_name" qui bloque aussi, on la rend optionnelle
ALTER TABLE public.photos 
ALTER COLUMN guest_name DROP NOT NULL;
