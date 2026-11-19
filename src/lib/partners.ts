import { supabase } from '@/lib/supabase';
import type { Partner } from '@/types';

export type PartnerApplication = Pick<Partner, 'first_name' | 'last_name' | 'company' | 'activity' | 'website' | 'weddings_per_year'>;

export const ACTIVITIES: { value: Partner['activity']; label: string }[] = [
  { value: 'photographer', label: 'Photographe' },
  { value: 'wedding_planner', label: 'Wedding Planner' },
  { value: 'venue', label: 'Lieu de réception' },
  { value: 'dj', label: 'DJ / Animateur' },
  { value: 'other', label: 'Autre' },
];

// Candidature conservée pendant la confirmation de l'email (jamais le mot de passe).
const DRAFT_KEY = 'partner_application_draft';

export function savePartnerDraft(app: PartnerApplication) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(app)); } catch { /* stockage indisponible */ }
}
export function loadPartnerDraft(): PartnerApplication | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}
function clearPartnerDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* stockage indisponible */ }
}

// Enregistre la candidature de l'utilisateur connecté (statut, code et commission sont fixés
// par la base) puis prévient l'équipe par email.
export async function submitPartnerApplication(app: PartnerApplication): Promise<void> {
  const { error } = await supabase.from('partners').insert(app);
  if (error && !/duplicate key/i.test(error.message)) throw error;
  clearPartnerDraft();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await fetch('/api/partners/notify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch((err) => console.error('Partner notify error:', err));
}
