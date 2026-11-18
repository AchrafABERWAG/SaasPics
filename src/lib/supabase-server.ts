import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client "service_role" : contourne les RLS. À utiliser uniquement dans les routes API
// (webhook Stripe, envoi d'emails), jamais dans un composant client.
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.');
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

// Vérifie le token envoyé par le navigateur (header Authorization: Bearer <access_token>)
// et renvoie l'utilisateur connecté, ou null.
export async function getUserFromRequest(req: Request) {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
