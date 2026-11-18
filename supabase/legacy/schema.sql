
-- Enable RLS
alter table auth.users enable row level security;

-- Events Table (The Wedding)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- 'mariage-julie-thomas'
  name text not null,
  date date not null,
  passcode text, -- simple code for guests if needed
  created_at timestamptz default now(),
  owner_id uuid references auth.users(id)
);

-- Turn on RLS
alter table public.events enable row level security;

-- Policies for Events
create policy "Public read access for events"
  on public.events for select
  using (true);

-- Photos Table
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  storage_path text not null, -- 'events/slug/filename.jpg'
  caption text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  uploader_id uuid default auth.uid(), -- can be null if anon
  created_at timestamptz default now()
);

-- Turn on RLS
alter table public.photos enable row level security;

-- Policies for Photos
create policy "Anyone can upload photos"
  on public.photos for insert
  with check (true);

create policy "Public view approved photos"
  on public.photos for select
  using (status = 'approved' or status = 'pending'); 
  -- Note: In production, maybe only 'approved' for public wall, but for MVP 'pending' is fine if no mod.

-- Realtime
alter publication supabase_realtime add table public.photos;
