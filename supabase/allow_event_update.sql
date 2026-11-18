-- Allow anonymous updates to events (for Admin Dashboard)
-- Ideally this should be restricted, but for this MVP phase we use the hidden URL as security.
CREATE POLICY "Enable update for anyone" ON "public"."events"
AS PERMISSIVE FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
