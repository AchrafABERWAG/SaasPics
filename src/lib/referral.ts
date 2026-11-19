// Code de parrainage partenaire (?ref=CODE), mémorisé 30 jours dans le navigateur
// pour être rattaché à l'événement même si la création a lieu plus tard.
const KEY = 'partner_ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Za-z0-9]{4,32}$/;

export function saveReferralCode(code: string | null | undefined): void {
  if (!code || !CODE_RE.test(code)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
  } catch {
    // stockage indisponible (navigation privée...) : tant pis
  }
}

export function getReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return CODE_RE.test(code) ? code : null;
  } catch {
    return null;
  }
}
