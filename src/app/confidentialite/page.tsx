import type { Metadata } from 'next';
import LegalPage, { F } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';
import { PLANS, PURGE_GRACE_DAYS } from '@/lib/plans';

export const metadata: Metadata = { title: `Politique de confidentialité — ${LEGAL.brand}` };

export default function ConfidentialitePage() {
    return (
        <LegalPage title="Politique de confidentialité">
            <h2>Responsable du traitement</h2>
            <p><F v={LEGAL.companyName} />, <F v={LEGAL.address} /> — contact : <F v={LEGAL.email} />.</p>

            <h2>Données collectées et utilisation</h2>
            <table>
                <thead>
                    <tr><th>Données</th><th>Pourquoi</th><th>Base légale</th><th>Conservation</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Compte : email, mot de passe (chiffré)</td>
                        <td>Accès à votre espace, emails liés au service</td>
                        <td>Exécution du contrat</td>
                        <td>Jusqu&apos;à la suppression du compte</td>
                    </tr>
                    <tr>
                        <td>Événement : prénoms des mariés, date, réglages</td>
                        <td>Fournir le service</td>
                        <td>Exécution du contrat</td>
                        <td>Jusqu&apos;à la suppression de l&apos;événement ou du compte</td>
                    </tr>
                    <tr>
                        <td>Photos envoyées par les invités (pouvant montrer des personnes)</td>
                        <td>Galerie, Live Wall, téléchargement par l&apos;organisateur</td>
                        <td>Exécution du contrat conclu avec l&apos;organisateur ; consentement de l&apos;invité qui envoie la photo</td>
                        <td>
                            Durée du pack ({PLANS.discovery.galleryDuration} pour {PLANS.discovery.label}, {PLANS.essential.galleryDuration} pour les packs payants),
                            puis suppression définitive {PURGE_GRACE_DAYS} jours après la fermeture
                        </td>
                    </tr>
                    <tr>
                        <td>Paiements : montant, pack, identifiants Stripe (jamais votre numéro de carte)</td>
                        <td>Facturation, comptabilité, commissions partenaires</td>
                        <td>Obligation légale</td>
                        <td>10 ans</td>
                    </tr>
                    <tr>
                        <td>Partenaires : nom, entreprise, activité, site web</td>
                        <td>Étude de la candidature, suivi des commissions</td>
                        <td>Mesures précontractuelles / contrat</td>
                        <td>Durée du partenariat, puis 3 ans</td>
                    </tr>
                    <tr>
                        <td>Signalements de photos : photo concernée, motif</td>
                        <td>Retrait des contenus illicites</td>
                        <td>Obligation légale / intérêt légitime</td>
                        <td>1 an</td>
                    </tr>
                </tbody>
            </table>
            <p>
                Les invités n&apos;ont pas besoin de compte : nous ne collectons ni leur nom ni leur email. Aucune donnée n&apos;est vendue
                ni utilisée à des fins publicitaires.
            </p>

            <h2>Destinataires et sous-traitants</h2>
            <ul>
                <li><strong>Supabase</strong> : base de données, stockage des photos et authentification — serveurs en <F v={LEGAL.dataRegion} />.</li>
                <li><strong>Stripe</strong> : paiement.</li>
                <li><strong>Resend</strong> : envoi des emails.</li>
                <li><strong><F v={LEGAL.host.name} /></strong> : hébergement du site.</li>
            </ul>
            <p>
                Certains de ces prestataires sont établis hors de l&apos;Union européenne (États-Unis). Les transferts sont encadrés par les
                clauses contractuelles types de la Commission européenne et, le cas échéant, le cadre de protection des données UE–États-Unis.
            </p>
            <p>
                Les photos d&apos;un événement sont visibles par l&apos;organisateur et par toute personne disposant du lien de l&apos;événement.
            </p>

            <h2>Cookies et stockage local</h2>
            <p>
                Nous n&apos;utilisons aucun cookie publicitaire ni de mesure d&apos;audience. Le site enregistre seulement dans votre navigateur
                les éléments nécessaires à son fonctionnement : votre session de connexion, les photos en attente d&apos;envoi (mode hors ligne)
                et, si vous êtes arrivé par le lien d&apos;un partenaire, son code pendant 30 jours. Ces éléments ne nécessitent pas de
                consentement préalable.
            </p>

            <h2>Vos droits</h2>
            <p>
                Vous pouvez accéder à vos données, les rectifier, les supprimer, en limiter le traitement, vous y opposer et demander leur
                portabilité. L&apos;organisateur peut supprimer lui-même ses photos, son événement ou son compte depuis son espace.
                Un invité qui souhaite le retrait d&apos;une photo où il apparaît peut la signaler depuis la galerie ou écrire à <F v={LEGAL.email} />.
            </p>
            <p>
                Vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr).
            </p>
        </LegalPage>
    );
}
