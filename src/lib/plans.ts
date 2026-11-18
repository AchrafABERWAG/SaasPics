import type { PlanType } from '@/types';

// Source unique des packs côté application.
// Les limites sont appliquées par la base (supabase/migrations : plan_max_photos, plan_expiry) :
// garder ces valeurs synchronisées.
export const PLANS: Record<PlanType, {
  label: string;
  priceCents: number;
  maxPhotos: number | null;
  galleryDuration: string;
  liveWall: boolean;
  moderation: boolean;
  challenges: boolean;
  zipDownload: boolean;
}> = {
  discovery: {
    label: 'Découverte',
    priceCents: 0,
    maxPhotos: 30,
    galleryDuration: '48 h',
    liveWall: false,
    moderation: false,
    challenges: false,
    zipDownload: false,
  },
  essential: {
    label: 'Essentiel',
    priceCents: 5900,
    maxPhotos: null,
    galleryDuration: '1 an',
    liveWall: false,
    moderation: false,
    challenges: false,
    zipDownload: true,
  },
  premium: {
    label: 'Premium',
    priceCents: 9900,
    maxPhotos: null,
    galleryDuration: '1 an',
    liveWall: true,
    moderation: true,
    challenges: true,
    zipDownload: true,
  },
};

// Les photos d'une galerie fermée sont supprimées après ce délai (voir purge_grace_period en SQL).
export const PURGE_GRACE_DAYS = 7;

const RANK: Record<PlanType, number> = { discovery: 0, essential: 1, premium: 2 };

export type PaidPlan = Exclude<PlanType, 'discovery'>;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'essential' || value === 'premium';
}

export function canUpgrade(from: PlanType, to: PlanType): boolean {
  return RANK[to] > RANK[from];
}

// Montant à payer pour passer de `from` à `to` : on ne paie que la différence.
export function upgradePriceCents(from: PlanType, to: PaidPlan): number {
  return PLANS[to].priceCents - PLANS[from].priceCents;
}

// Pack le plus élevé parmi une liste (ex: commandes non remboursées).
export function highestPlan(plans: PlanType[]): PlanType {
  return plans.reduce<PlanType>((best, p) => (RANK[p] > RANK[best] ? p : best), 'discovery');
}

export function formatPrice(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0 })} €`;
}
