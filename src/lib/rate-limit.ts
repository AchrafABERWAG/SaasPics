import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// Adresse IP du visiteur, telle que transmise par l'hébergeur (Vercel, proxy...).
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

// Limite `max` appels par minute et par IP pour une route donnée (compteur en base, voir
// migration 0007). Renvoie une réponse 429 si la limite est dépassée, sinon null.
// En cas de panne du compteur, la requête passe : on ne bloque pas les vrais clients.
export async function rateLimit(req: Request, route: string, max: number): Promise<NextResponse | null> {
  const { data, error } = await getSupabaseAdmin().rpc('rate_limit_hit', {
    p_key: `${route}:${clientIp(req)}`,
    p_max: max,
    p_window_seconds: 60,
  });
  if (error) {
    console.error('rate_limit_hit error:', error);
    return null;
  }
  if (data === false) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Merci de réessayer dans une minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
  return null;
}
