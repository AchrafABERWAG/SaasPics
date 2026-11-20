export type PlanType = 'discovery' | 'essential' | 'premium';

// Ligne complète de la table events (visible uniquement par son admin).
export type Event = {
  id: string;
  slug: string;
  name: string;
  date: string;
  created_at: string;
  admin_id: string;
  plan_type: PlanType;
  groom_name?: string | null;
  bride_name?: string | null;
  moderation_enabled: boolean;
  expires_at: string | null;
  ref_code?: string | null;
  referred_by?: string | null;
  purged_at?: string | null; // photos supprimées après expiration de la galerie
};

// Données publiques d'un événement, renvoyées par la RPC get_event_public(slug).
export type PublicEvent = Pick<
  Event,
  'id' | 'slug' | 'name' | 'date' | 'bride_name' | 'groom_name' | 'plan_type' | 'moderation_enabled' | 'expires_at'
> & {
  photo_count: number;        // toutes les photos envoyées (y compris en attente)
  max_photos: number | null;  // null = illimité
  is_demo?: boolean;          // événement de démonstration : lecture seule
};

export type Photo = {
  id: string;
  event_id: string;
  storage_path: string;
  thumb_path?: string | null;   // miniature (~480 px) pour les grilles ; absente sur les anciennes photos
  caption?: string | null;      // petit mot facultatif de l'invité
  guest_name?: string | null;   // prénom facultatif de l'invité
  status: 'pending' | 'approved' | 'rejected';
  uploader_id?: string | null;
  created_at: string;
};

// Photo approuvée, renvoyée par la RPC get_event_photos (et par le canal temps réel).
export type PublicPhoto = Pick<Photo, 'id' | 'storage_path' | 'thumb_path' | 'caption' | 'guest_name' | 'created_at'>;

export interface Challenge {
  id: string;
  event_id: string;
  title: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
}

export type Partner = {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  first_name: string;
  last_name: string;
  company?: string | null;
  activity: 'photographer' | 'wedding_planner' | 'venue' | 'dj' | 'other';
  website?: string | null;
  weddings_per_year?: '1-10' | '10-30' | '30+' | null;
  referral_code: string | null;
  commission_rate: number;
  approved_at: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  event_id: string | null;
  user_id: string | null;
  partner_id: string | null;
  event_name: string | null;
  plan_type: 'essential' | 'premium';
  amount_cents: number;
  currency: string;
  status: 'paid' | 'refunded';
  commission_cents: number;
  commission_paid_at: string | null;
  created_at: string;
};
