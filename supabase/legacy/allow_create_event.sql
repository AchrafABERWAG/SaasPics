-- Allow anyone (public/anon) to insert into 'events' table
-- This is necessary for the Self-Service Create Page to work without login.

-- 1. Enable RLS on events if not already done (it should be)
alter table "public"."events" enable row level security;

-- 2. Create Policy for INSERT
create policy "Enable insert for everyone"
on "public"."events"
as permissive
for insert
to public
with check (true);

-- 3. Ensure SELECT is allowed for the creator (by slug usually) OR public
-- (Depending on your existing policies. Usually we want public read for events)
create policy "Enable read access for all users"
on "public"."events"
as permissive
for select
to public
using (true);

-- 4. Grant usage on uuid-ossp if needed (usually already there)
-- create extension if not exists "uuid-ossp";
