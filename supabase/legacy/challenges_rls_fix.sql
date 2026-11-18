-- Drop strict policies
drop policy "Event owners can manage challenges" on public.challenges;

-- Allow public access (MVP Style - protecting via client-side passcode check)
create policy "Public full access for challenges"
  on public.challenges for all
  using (true)
  with check (true);
