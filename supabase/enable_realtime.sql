
-- Activer la publication Realtime pour la table 'photos'
-- C'est indispensable pour que le Live Wall reçoive les notifications d'ajout.
alter publication supabase_realtime add table photos;
