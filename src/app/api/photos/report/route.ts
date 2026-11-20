import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getUserEmail, sendEventEmailOnce } from '@/lib/notifications';
import { photoReportedEmail } from '@/lib/email-templates';
import { photoUrl } from '@/lib/events';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REPORTS_PER_PHOTO = 20;

// Signalement d'une photo par un invité (sans compte).
// Seules les photos publiées d'une galerie ouverte peuvent être signalées ; l'organisateur et
// l'équipe (ADMIN_NOTIFICATION_EMAIL) sont prévenus une seule fois par photo.
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'report', 10);
  if (limited) return limited;

  const { photoId, reason } = (await req.json().catch(() => ({}))) as { photoId?: string; reason?: string };
  const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  if (typeof photoId !== 'string' || !UUID_RE.test(photoId) || !cleanReason) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: photo } = await db
    .from('photos')
    .select('id, event_id, storage_path, status, events(id, slug, name, admin_id, expires_at)')
    .eq('id', photoId)
    .maybeSingle();
  const event = photo?.events as unknown as { id: string; slug: string; name: string; admin_id: string; expires_at: string | null } | null;
  const visible = photo?.status === 'approved' && event && (!event.expires_at || new Date(event.expires_at) > new Date());
  if (!photo || !event || !visible) {
    return NextResponse.json({ error: 'Photo introuvable.' }, { status: 404 });
  }

  const { count } = await db.from('photo_reports').select('id', { count: 'exact', head: true }).eq('photo_id', photoId);
  if ((count ?? 0) < MAX_REPORTS_PER_PHOTO) {
    const { error } = await db.from('photo_reports').insert({ photo_id: photoId, event_id: event.id, reason: cleanReason });
    if (error) {
      console.error('Photo report insert error:', error);
      return NextResponse.json({ error: 'Erreur de traitement.' }, { status: 500 });
    }
  }

  const common = { eventName: event.name, slug: event.slug, reason: cleanReason, photoLink: photoUrl(photo.storage_path) };
  try {
    const owner = await getUserEmail(event.admin_id);
    if (owner) {
      await sendEventEmailOnce({ eventId: event.id, kind: 'photo_report', ref: photoId, to: owner,
        template: photoReportedEmail({ ...common, forPlatform: false }) });
    }
    const platform = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (platform) {
      await sendEventEmailOnce({ eventId: event.id, kind: 'photo_report', ref: `platform:${photoId}`, to: platform,
        template: photoReportedEmail({ ...common, forPlatform: true }) });
    }
  } catch (err) {
    // Le signalement est enregistré même si l'email échoue.
    console.error('Photo report email error:', err);
  }

  return NextResponse.json({ status: 'reported' });
}
