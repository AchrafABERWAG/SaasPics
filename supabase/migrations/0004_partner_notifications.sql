-- =============================================================================
-- 0004_partner_notifications.sql — Suivi des emails de la section Pro
--   * application_notified_at : vous avez été prévenu de la candidature
--   * approval_notified_at    : le partenaire a été prévenu de sa validation
-- Ces colonnes ne sont modifiables que par le serveur.
-- =============================================================================

alter table public.partners
  add column application_notified_at timestamptz,
  add column approval_notified_at timestamptz;

create or replace function public.partners_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();
      new.status := 'pending';
      new.referral_code := null;
      new.commission_rate := 0.200;
      new.approved_at := null;
      new.application_notified_at := null;
      new.approval_notified_at := null;
    else
      new.user_id := old.user_id;
      new.status := old.status;
      new.referral_code := old.referral_code;
      new.commission_rate := old.commission_rate;
      new.approved_at := old.approved_at;
      new.created_at := old.created_at;
      new.application_notified_at := old.application_notified_at;
      new.approval_notified_at := old.approval_notified_at;
    end if;
  end if;

  if new.status = 'approved' then
    if new.referral_code is null then
      new.referral_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    end if;
    if new.approved_at is null then
      new.approved_at := now();
    end if;
  end if;

  return new;
end;
$$;
