import { supabase } from '@/lib/supabase';

// Appel POST authentifié vers une route API du site. Lève une erreur lisible en cas d'échec.
export async function authedPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Vous devez être connecté.');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data as T;
}
