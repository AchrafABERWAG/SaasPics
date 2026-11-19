import { BRAND } from '@/lib/brand';

// Informations légales de l'éditeur : À COMPLÉTER avant la mise en vente.
// Tant qu'une valeur commence par "[À COMPLÉTER", elle est affichée en rouge sur les pages légales.
export const LEGAL = {
  brand: BRAND.name,
  companyName: '[À COMPLÉTER : nom et prénom, ou raison sociale]',
  legalForm: '[À COMPLÉTER : micro-entreprise / SASU / EURL…]',
  shareCapital: '', // ex: "1 000 €" (société uniquement ; laisser vide sinon)
  siret: '[À COMPLÉTER : SIRET]',
  rcs: '', // ex: "RCS Paris 123 456 789" (société uniquement)
  vatNumber: '', // ex: "FR12345678901" ; vide = "TVA non applicable, art. 293 B du CGI" (franchise)
  address: '[À COMPLÉTER : adresse postale]',
  email: '[À COMPLÉTER : email de contact]',
  phone: '', // facultatif
  publicationDirector: '[À COMPLÉTER : directeur de la publication]',
  host: {
    name: '[À COMPLÉTER : hébergeur du site, ex: Vercel Inc.]',
    address: '[À COMPLÉTER : adresse de l’hébergeur (indiquée dans ses propres mentions légales)]',
  },
  // Médiateur de la consommation (obligatoire pour vendre à des particuliers).
  mediator: {
    name: '[À COMPLÉTER : médiateur de la consommation]',
    website: '[À COMPLÉTER : site du médiateur]',
  },
  // Région de la base de données Supabase choisie à la création du projet.
  dataRegion: '[À COMPLÉTER : ex: Union européenne (Francfort)]',
  // Changer cette valeur à chaque modification des CGV : elle est enregistrée avec chaque acceptation.
  termsVersion: '2026-11-19',
  lastUpdated: '19 novembre 2026',
};

export function isPlaceholder(value: string): boolean {
  return value.startsWith('[À COMPLÉTER');
}

export const LEGAL_LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgv', label: 'CGV / CGU' },
  { href: '/confidentialite', label: 'Confidentialité' },
];
