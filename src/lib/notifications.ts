import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';

type Template = { subject: string; html: string; text: string };
type EmailKind = 'welcome' | 'payment_confirmed' | 'partner_sale' | 'gallery_ready' | 'expiring_soon';

export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.email ?? null;
}

// Envoie un email au plus une fois par (événement, type, ref).
// Le journal est écrit AVANT l'envoi (deux appels simultanés ne peuvent pas envoyer deux fois)
// et retiré si l'envoi échoue, pour permettre une nouvelle tentative.
export async function sendEventEmailOnce(params: {
  eventId: string;
  kind: EmailKind;
  ref?: string;
  to: string;
  template: Template;
}): Promise<'sent' | 'already_sent'> {
  const db = getSupabaseAdmin();
  const { data: logRow, error } = await db
    .from('email_log')
    .insert({ event_id: params.eventId, kind: params.kind, ref: params.ref ?? '', sent_to: params.to })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return 'already_sent';
    throw error;
  }

  try {
    await sendEmail({ to: params.to, ...params.template });
    return 'sent';
  } catch (err) {
    await db.from('email_log').delete().eq('id', logRow.id);
    throw err;
  }
}
