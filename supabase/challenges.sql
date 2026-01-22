-- Challenges Table
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  text text not null,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- Turn on RLS
alter table public.challenges enable row level security;

-- Policies for Challenges
create policy "Public read access for challenges"
  on public.challenges for select
  using (true);

create policy "Event owners can manage challenges"
  on public.challenges for all
  using (auth.uid() = (select owner_id from public.events where id = event_id));
