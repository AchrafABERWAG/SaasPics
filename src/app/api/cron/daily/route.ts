import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getUserEmail, sendEventEmailOnce } from '@/lib/notifications';
import { expiringSoonEmail, galleryReadyEmail } from '@/lib/email-templates';
import type { PlanType } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Tâche quotidienne (à appeler une fois par jour, ex: 9h) :
//   - "galerie prête" le lendemain du jour J
//   - "galerie bientôt fermée" : 24 h avant pour Découverte, 7 jours avant pour les packs payants
// Protégée par CRON_SECRET (header Authorization: Bearer <secret>, envoyé automatiquement par Vercel Cron).
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const summary = { gallery_ready: 0, expiring_soon: 0, skipped: 0, errors: 0 };
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

  return NextResponse.json(summary);
}

async function notify(
  summary: { gallery_ready: number; expiring_soon: number; skipped: number; errors: number },
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
