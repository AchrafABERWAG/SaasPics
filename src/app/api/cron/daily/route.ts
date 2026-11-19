import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getUserEmail, sendEventEmailOnce } from '@/lib/notifications';
import { expiringSoonEmail, galleryReadyEmail, partnerApprovedEmail } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { purgeEventPhotos } from '@/lib/purge';
import type { PlanType } from '@/types';

type Summary = { gallery_ready: number; expiring_soon: number; purged_events: number; purged_files: number; partners_approved: number; skipped: number; errors: number };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Tâche quotidienne (à appeler une fois par jour, ex: 9h) :
//   - "galerie prête" le lendemain du jour J
//   - "galerie bientôt fermée" : 24 h avant pour Découverte, 7 jours avant pour les packs payants
//   - suppression des photos des galeries fermées depuis plus de 7 jours (purge_grace_period)
//   - email de bienvenue aux partenaires validés (statut passé à approved dans Supabase)
// Protégée par CRON_SECRET (header Authorization: Bearer <secret>, envoyé automatiquement par Vercel Cron).
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const summary: Summary = { gallery_ready: 0, expiring_soon: 0, purged_events: 0, purged_files: 0, partners_approved: 0, skipped: 0, errors: 0 };
  const db = getSupabaseAdmin();

  // 1. Galerie prête (événements d'hier, heure de Paris)
  const { data: yesterdayEvents, error: e1 } = await db
    .from('events')
    .select('id, slug, name, plan_type, admin_id')
    .eq('date', parisDate(-1))
    .limit(BATCH);
  if (e1) return failure(e1);

  for (const ev of yesterdayEvents ?? []) {
    const { count } = await db
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', ev.id)
      .eq('status', 'approved');
    if (!count) { summary.skipped++; continue; }

    await notify(summary, 'gallery_ready', ev.id, ev.admin_id, '', galleryReadyEmail({
      eventName: ev.name, slug: ev.slug, plan: ev.plan_type as PlanType, photoCount: count,
    }));
  }

  // 2. Galerie bientôt fermée
  const now = Date.now();
  const { data: expiring, error: e2 } = await db
    .from('events')
    .select('id, slug, name, plan_type, admin_id, expires_at')
    .gt('expires_at', new Date(now).toISOString())
    .lte('expires_at', new Date(now + 7 * DAY_MS).toISOString())
    .limit(BATCH);
  if (e2) return failure(e2);

  for (const ev of expiring ?? []) {
    const remainingMs = new Date(ev.expires_at).getTime() - now;
    const threshold = ev.plan_type === 'discovery' ? DAY_MS : 7 * DAY_MS;
    if (remainingMs > threshold) { summary.skipped++; continue; }

    // ref = date d'expiration : si le pack change (nouvelle date), un nouveau rappel pourra partir.
    await notify(summary, 'expiring_soon', ev.id, ev.admin_id, ev.expires_at, expiringSoonEmail({
      eventName: ev.name, slug: ev.slug, plan: ev.plan_type as PlanType, expiresAt: ev.expires_at,
    }));
  }

  // 3. Suppression des photos des galeries expirées (fichiers + lignes ; l'événement est conservé)
  const { data: toPurge, error: e3 } = await db.rpc('events_to_purge', { p_limit: 50 });
  if (e3) return failure(e3);

  for (const { id } of (toPurge ?? []) as { id: string }[]) {
    try {
      summary.purged_files += await purgeEventPhotos(id);
      summary.purged_events++;
    } catch (err) {
      summary.errors++;
      console.error(`Cron purge error for event ${id}:`, err);
    }
  }

  // 4. Partenaires validés depuis la dernière exécution
  const { data: approved, error: e4 } = await db
    .from('partners')
    .select('id, user_id, first_name, referral_code, commission_rate')
    .eq('status', 'approved')
    .is('approval_notified_at', null)
    .limit(BATCH);
  if (e4) return failure(e4);

  for (const partner of approved ?? []) {
    try {
      // Marquage atomique avant l'envoi (pas de doublon si deux exécutions se chevauchent).
      const { data: claimed } = await db.from('partners')
        .update({ approval_notified_at: new Date().toISOString() })
        .eq('id', partner.id).is('approval_notified_at', null).select('id').maybeSingle();
      if (!claimed) { summary.skipped++; continue; }
      const to = await getUserEmail(partner.user_id);
      if (!to) { summary.skipped++; continue; }
      try {
        await sendEmail({ to, ...partnerApprovedEmail({ firstName: partner.first_name, referralCode: partner.referral_code, commissionRate: Number(partner.commission_rate) }) });
        summary.partners_approved++;
      } catch (err) {
        await db.from('partners').update({ approval_notified_at: null }).eq('id', partner.id);
        throw err;
      }
    } catch (err) {
      summary.errors++;
      console.error(`Cron partner approval email error for :`, err);
    }
  }

  return NextResponse.json(summary);
}

async function notify(
  summary: Summary,
  kind: 'gallery_ready' | 'expiring_soon',
  eventId: string, adminId: string, ref: string,
  template: { subject: string; html: string; text: string }
) {
  try {
    const to = await getUserEmail(adminId);
    if (!to) { summary.skipped++; return; }
    const result = await sendEventEmailOnce({ eventId, kind, ref, to, template });
    if (result === 'sent') summary[kind]++;
    else summary.skipped++;
  } catch (err) {
    summary.errors++;
    console.error(`Cron ${kind} error for event ${eventId}:`, err);
  }
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Date (AAAA-MM-JJ) à Paris, décalée de `offsetDays` jours.
function parisDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * DAY_MS);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

function failure(err: unknown) {
  console.error('Cron query error:', err);
  return NextResponse.json({ error: 'Erreur de traitement.' }, { status: 500 });
}
