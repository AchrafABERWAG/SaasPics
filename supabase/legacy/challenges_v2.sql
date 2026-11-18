-- Challenges Table v2
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  is_active boolean default false,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz default now()
);

-- Turn on RLS
alter table public.challenges enable row level security;

-- Policies for Challenges (Permissive for MVP/Passcode auth)
-- Read: Everyone (Guests need to see challenges)
create policy "Public read access for challenges"
  on public.challenges for select
  using (true);

-- Write: Everyone (Since we rely on client-side passcode for admin, we likely need open write or owner-based if authenticated)
-- Given the previous issue, we'll keep it permissive for now but we can restrict if using Supabase Auth properly.
-- MVP Approach for Admin Actions:
create policy "Public write access for challenges"
  on public.challenges for insert
  with check (true);

create policy "Public update access for challenges"
  on public.challenges for update
  using (true);

create policy "Public delete access for challenges"
  on public.challenges for delete
  using (true);
