import { BRAND, siteUrl } from '@/lib/brand';
import { PLANS, formatPrice } from '@/lib/plans';
import type { PlanType } from '@/types';

type Template = { subject: string; html: string; text: string };

// Tout texte venant d'un utilisateur (nom d'événement, prénoms...) passe par ici.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Les sujets ne sont pas du HTML, mais on retire les retours à la ligne (injection d'en-têtes).
function subjectSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 120);
}

const COLORS = { gold: '#D4AF37', text: '#333333', muted: '#777777', bg: '#F9F5F0' };

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${COLORS.gold};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">${escapeHtml(label)}</a>`;
}

// `bodyHtml` doit déjà être échappé par l'appelant.
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:32px;font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};line-height:1.6;">
        <tr><td>
          <p style="margin:0 0 24px 0;font-family:Georgia,serif;font-size:22px;color:${COLORS.gold};">${escapeHtml(BRAND.name)}</p>
          <h1 style="margin:0 0 16px 0;font-size:20px;">${escapeHtml(title)}</h1>
          ${bodyHtml}
          <p style="margin:32px 0 0 0;font-size:13px;color:${COLORS.muted};">
            L'équipe ${escapeHtml(BRAND.name)}<br>
            <a href="${escapeHtml(siteUrl())}" style="color:${COLORS.muted};">${escapeHtml(siteUrl().replace(/^https?:\/\//, ''))}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 16px 0;">${html}</p>`;

function eventLinks(slug: string) {
  const base = siteUrl();
  return {
    admin: `${base}/admin/${slug}`,
    guest: `${base}/event/${slug}`,
    live: `${base}/live/${slug}`,
    pricing: `${base}/pricing`,
  };
}

// ---------------------------------------------------------------------------

export function welcomeEmail(params: { eventName: string; slug: string; plan: PlanType }): Template {
  const { eventName, slug, plan } = params;
  const links = eventLinks(slug);
  const name = escapeHtml(eventName);
  const planInfo = PLANS[plan];
  const limits = planInfo.maxPhotos
    ? `${planInfo.maxPhotos} photos, galerie disponible ${planInfo.galleryDuration} après le jour J`
    : `photos illimitées, galerie disponible ${planInfo.galleryDuration}`;

  return {
    subject: subjectSafe(`Votre espace ${eventName} est prêt`),
    html: layout(`Bienvenue ! Votre espace « ${eventName} » est prêt`, [
      p(`Votre événement <strong>${name}</strong> a bien été créé avec le pack <strong>${escapeHtml(planInfo.label)}</strong> (${escapeHtml(limits)}).`),
      p(button(links.admin, 'Accéder à mon espace')),
      p(`Lien à partager avec vos invités (ou via les chevalets QR code à imprimer depuis votre espace) :<br><a href="${escapeHtml(links.guest)}">${escapeHtml(links.guest)}</a>`),
      plan === 'discovery'
        ? p(`Envie de photos illimitées et du Live Wall ? <a href="${escapeHtml(links.admin)}">Passez à un pack supérieur</a> depuis votre espace.`)
        : '',
      p(`<span style="font-size:13px;color:${COLORS.muted};">Pour des raisons de sécurité, nous ne vous envoyons jamais votre mot de passe. En cas d'oubli, utilisez « Mot de passe oublié » sur la page de connexion.</span>`),
    ].join('')),
    text: [
      `Votre événement "${eventName}" a bien été créé avec le pack ${planInfo.label} (${limits}).`,
      `Votre espace : ${links.admin}`,
      `Lien pour vos invités : ${links.guest}`,
    ].join('\n\n'),
  };
}

export function paymentConfirmedEmail(params: { eventName: string; slug: string; plan: PlanType; amountCents: number }): Template {
  const { eventName, slug, plan, amountCents } = params;
  const links = eventLinks(slug);
  const planInfo = PLANS[plan];
  const features = [
    'Photos illimitées',
    `Galerie disponible ${planInfo.galleryDuration}`,
    'Téléchargement ZIP HD',
    ...(planInfo.liveWall ? ['Live Wall sur grand écran'] : []),
    ...(planInfo.challenges ? ['Défis photo'] : []),
  ];

  return {
    subject: subjectSafe(`Paiement confirmé — Pack ${planInfo.label} activé`),
    html: layout(`Merci ! Votre pack ${planInfo.label} est activé`, [
      p(`Nous avons bien reçu votre paiement de <strong>${escapeHtml(formatPrice(amountCents))}</strong> pour <strong>${escapeHtml(eventName)}</strong>.`),
      `<ul style="margin:0 0 16px 0;padding-left:20px;">${features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`,
      planInfo.liveWall
        ? p(`Le Live Wall est à afficher sur un écran ou un vidéoprojecteur : <a href="${escapeHtml(links.live)}">${escapeHtml(links.live)}</a>`)
        : '',
      p(button(links.admin, 'Accéder à mon espace')),
      p(`Lien à partager avec vos invités :<br><a href="${escapeHtml(links.guest)}">${escapeHtml(links.guest)}</a>`),
      p(`<span style="font-size:13px;color:${COLORS.muted};">Votre facture vous est envoyée séparément par notre prestataire de paiement (Stripe).</span>`),
    ].join('')),
    text: [
      `Nous avons bien reçu votre paiement de ${formatPrice(amountCents)} pour "${eventName}". Votre pack ${planInfo.label} est activé.`,
      features.map(f => `- ${f}`).join('\n'),
      `Votre espace : ${links.admin}`,
      `Lien pour vos invités : ${links.guest}`,
    ].join('\n\n'),
  };
}

export function partnerSaleEmail(params: { eventName: string; plan: PlanType; commissionCents: number }): Template {
  const { eventName, plan, commissionCents } = params;
  const dashboard = `${siteUrl()}/pro/dashboard`;
  return {
    subject: subjectSafe(`Nouvelle vente parrainée : ${formatPrice(commissionCents)} de commission`),
    html: layout('Nouvelle vente grâce à vous', [
      p(`Un de vos clients vient de souscrire le pack <strong>${escapeHtml(PLANS[plan].label)}</strong> pour <strong>${escapeHtml(eventName)}</strong>.`),
      p(`Votre commission : <strong>${escapeHtml(formatPrice(commissionCents))}</strong>.`),
      p(button(dashboard, 'Voir mon tableau de bord')),
    ].join('')),
    text: `Un de vos clients vient de souscrire le pack ${PLANS[plan].label} pour "${eventName}". Votre commission : ${formatPrice(commissionCents)}.\n\n${dashboard}`,
  };
}

export function partnerApplicationEmail(params: {
  firstName: string; lastName: string; email: string; company?: string | null;
  activity: string; website?: string | null; weddingsPerYear?: string | null;
}): Template {
  const rows: [string, string | null | undefined][] = [
    ['Nom', `${params.firstName} ${params.lastName}`],
    ['Email', params.email],
    ['Entreprise', params.company],
    ['Activité', params.activity],
    ['Site / Instagram', params.website],
    ['Mariages par an', params.weddingsPerYear],
  ];
  const table = `<table role="presentation" cellpadding="6" style="border-collapse:collapse;margin:0 0 16px 0;">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:${COLORS.muted};">${escapeHtml(k)}</td><td><strong>${escapeHtml(String(v))}</strong></td></tr>`)
    .join('')}</table>`;

  return {
    subject: subjectSafe(`Nouvelle candidature partenaire : ${params.firstName} ${params.lastName}`),
    html: layout('Nouvelle candidature partenaire', [
      table,
      p('Pour la valider : Supabase → Table Editor → <code>partners</code> → passer <code>status</code> à <code>approved</code>.'),
    ].join('')),
    text: rows.filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`).join('\n'),
  };
}

export function partnerApprovedEmail(params: { firstName: string; referralCode: string; commissionRate: number }): Template {
  const link = `${siteUrl()}/?ref=${encodeURIComponent(params.referralCode)}`;
  const dashboard = `${siteUrl()}/pro/dashboard`;
  const rate = `${Math.round(params.commissionRate * 100)} %`;
  return {
    subject: subjectSafe(`Bienvenue dans le réseau ${BRAND.name} !`),
    html: layout(`Votre compte partenaire est validé`, [
      p(`Bonjour ${escapeHtml(params.firstName)}, votre candidature a été acceptée.`),
      p(`Partagez votre lien personnel avec vos clients : vous touchez <strong>${escapeHtml(rate)}</strong> de commission sur chaque pack acheté.`),
      p(`<a href="${escapeHtml(link)}" style="word-break:break-all;">${escapeHtml(link)}</a><br><span style="color:${COLORS.muted};font-size:13px;">Code partenaire : <strong>${escapeHtml(params.referralCode)}</strong></span>`),
      p(button(dashboard, 'Mon tableau de bord')),
    ].join('')),
    text: `Bonjour ${params.firstName}, votre compte partenaire est validé.\n\nVotre lien : ${link}\nCode : ${params.referralCode}\nCommission : ${rate}\n\n${dashboard}`,
  };
}

export function galleryReadyEmail(params: { eventName: string; slug: string; plan: PlanType; photoCount: number }): Template {
  const { eventName, slug, plan, photoCount } = params;
  const links = eventLinks(slug);
  const zip = PLANS[plan].zipDownload;
  return {
    subject: subjectSafe(`${photoCount} souvenirs vous attendent — ${eventName}`),
    html: layout('Vos photos sont prêtes', [
      p(`Vos invités ont partagé <strong>${photoCount} photo${photoCount > 1 ? 's' : ''}</strong> pendant <strong>${escapeHtml(eventName)}</strong>.`),
      p(zip
        ? 'Retrouvez-les toutes dans votre espace et téléchargez-les en haute définition.'
        : `Votre galerie Découverte reste en ligne ${escapeHtml(PLANS.discovery.galleryDuration)} après le jour J. Passez à un pack supérieur pour la garder 1 an et tout télécharger en HD.`),
      p(button(links.admin, 'Voir mes photos')),
    ].join('')),
    text: `Vos invités ont partagé ${photoCount} photo(s) pendant "${eventName}".\n\n${links.admin}`,
  };
}

export function expiringSoonEmail(params: { eventName: string; slug: string; plan: PlanType; expiresAt: string }): Template {
  const { eventName, slug, plan, expiresAt } = params;
  const links = eventLinks(slug);
  const date = new Date(expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  return {
    subject: subjectSafe(`Votre galerie ${eventName} ferme le ${date}`),
    html: layout(`Votre galerie ferme le ${date}`, [
      p(`La galerie de <strong>${escapeHtml(eventName)}</strong> ne sera plus accessible après le <strong>${escapeHtml(date)}</strong>, et les photos seront ensuite supprimées.`),
      p(plan === 'discovery'
        ? 'Pour conserver vos souvenirs 1 an et les télécharger en HD, passez à un pack supérieur.'
        : "Pensez à télécharger toutes vos photos en HD depuis votre espace avant cette date."),
      p(button(links.admin, plan === 'discovery' ? 'Garder mes photos' : 'Télécharger mes photos')),
    ].join('')),
    text: `La galerie de "${eventName}" ferme le ${date}. Les photos seront ensuite supprimées.\n\n${links.admin}`,
  };
}
