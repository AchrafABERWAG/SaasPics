import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { partnerApplicationEmail } from '@/lib/email-templates';

export const runtime = 'nodejs';

const ACTIVITY_LABEL: Record<string, string> = {
  photographer: 'Photographe', wedding_planner: 'Wedding Planner', venue: 'Lieu de réception', dj: 'DJ / Animateur', other: 'Autre',
};

// Prévient l'équipe (ADMIN_NOTIFICATION_EMAIL) d'une nouvelle candidature partenaire.
// Appelé par le navigateur juste après l'enregistrement de la candidature ; envoyé une seule fois.
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  // Marque la candidature comme notifiée de façon atomique (pas de doublon si deux appels).
  const { data: partner, error } = await db
    .from('partners')
    .update({ application_notified_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('application_notified_at', null)
    .select('id, first_name, last_name, company, activity, website, weddings_per_year')
    .maybeSingle();
  if (error) {
    console.error('Partner notify error:', error);
    return NextResponse.json({ error: 'Erreur de traitement.' }, { status: 500 });
  }
  if (!partner) return NextResponse.json({ status: 'already_sent' });

  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn('ADMIN_NOTIFICATION_EMAIL non défini : candidature partenaire non notifiée.');
    return NextResponse.json({ status: 'not_configured' });
  }

  try {
    await sendEmail({
      to,
      ...partnerApplicationEmail({
        firstName: partner.first_name, lastName: partner.last_name, email: user.email, company: partner.company,
        activity: ACTIVITY_LABEL[partner.activity] ?? partner.activity, website: partner.website, weddingsPerYear: partner.weddings_per_year,
      }),
    });
    return NextResponse.json({ status: 'sent' });
  } catch (err) {
    console.error('Partner application email error:', err);
    await db.from('partners').update({ application_notified_at: null }).eq('id', partner.id);
    return NextResponse.json({ error: "L'email n'a pas pu être envoyé." }, { status: 502 });
  }
}
