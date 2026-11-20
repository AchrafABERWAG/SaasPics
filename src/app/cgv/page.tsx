import type { Metadata } from 'next';
import LegalPage, { F } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';
import { PLANS, PURGE_GRACE_DAYS, formatPrice } from '@/lib/plans';

export const metadata: Metadata = { title: 'CGV / CGU' };

export default function CgvPage() {
    const { discovery, essential, premium } = PLANS;
    return (
        <LegalPage title="Conditions générales de vente et d'utilisation">
            <p><em>Version {LEGAL.termsVersion}.</em></p>

            <h2>1. Objet</h2>
            <p>
                Les présentes conditions régissent l&apos;utilisation du service {LEGAL.brand}, édité par <F v={LEGAL.companyName} /> (ci-après
                « nous »), qui permet à un organisateur (ci-après « le Client ») de créer un espace en ligne où ses invités partagent
                des photos de son événement. Elles sont acceptées par le Client lors de la création de chaque événement, et par les
                invités lorsqu&apos;ils envoient une photo.
            </p>

            <h2>2. Les packs</h2>
            <ul>
                <li><strong>{discovery.label}</strong> (gratuit) : {discovery.maxPhotos} photos maximum, galerie accessible {discovery.galleryDuration} après la date de l&apos;événement.</li>
                <li><strong>{essential.label}</strong> ({formatPrice(essential.priceCents)}) : photos illimitées, galerie accessible {essential.galleryDuration}, téléchargement de toutes les photos en haute définition.</li>
                <li><strong>{premium.label}</strong> ({formatPrice(premium.priceCents)}) : tout le pack {essential.label}, plus le Live Wall et le diaporama sur grand écran, les défis photo et la modération des photos.</li>
            </ul>
            <p>
                Un pack s&apos;applique à un seul événement. Il ne s&apos;agit pas d&apos;un abonnement : le paiement est unique.
                Le passage d&apos;un pack à un pack supérieur est facturé à la différence de prix.
            </p>

            <h2>3. Compte</h2>
            <p>
                La création d&apos;un événement nécessite un compte (adresse email et mot de passe). Le Client est responsable de la
                confidentialité de ses identifiants et des liens de son événement : toute personne disposant du lien invités peut
                envoyer des photos et consulter la galerie.
            </p>

            <h2>4. Prix et paiement</h2>
            <p>
                Les prix sont indiqués en euros, toutes taxes comprises. {LEGAL.vatNumber ? '' : 'TVA non applicable, article 293 B du CGI. '}
                Le paiement est réalisé par carte bancaire via notre prestataire Stripe ; nous n&apos;avons jamais accès à vos données
                bancaires. Une facture est envoyée par email après chaque paiement. Le pack est activé dès la confirmation du paiement.
            </p>

            <h2>5. Droit de rétractation</h2>
            <p>
                Le Client consommateur dispose d&apos;un délai de 14 jours à compter du paiement pour se rétracter, sans avoir à se justifier,
                en écrivant à <F v={LEGAL.email} />. En validant sa commande, le Client demande expressément que le service soit fourni
                immédiatement, sans attendre la fin de ce délai.
            </p>
            <p>
                Si le Client se rétracte <strong>avant la date de son événement</strong>, il est intégralement remboursé sous 14 jours.
                Conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation ne peut plus être exercé
                <strong> une fois l&apos;événement passé</strong>, le service ayant alors été pleinement exécuté à la demande du Client.
            </p>

            <h2>6. Durée de conservation des photos</h2>
            <p>
                Les photos restent accessibles pendant la durée prévue par le pack. La galerie ferme ensuite et les photos sont
                <strong> définitivement supprimées {PURGE_GRACE_DAYS} jours après sa fermeture</strong>. Un email de rappel est envoyé avant
                la fermeture. Il appartient au Client de télécharger ses photos avant cette date ; nous ne conservons aucune copie.
            </p>

            <h2>7. Photos envoyées par les invités</h2>
            <p>En envoyant une photo, l&apos;invité garantit :</p>
            <ul>
                <li>en être l&apos;auteur, ou disposer des droits nécessaires ;</li>
                <li>avoir l&apos;accord des personnes reconnaissables sur la photo (droit à l&apos;image), et ne pas publier de photo d&apos;enfant sans l&apos;accord de ses parents ;</li>
                <li>que la photo n&apos;est pas illicite, violente, pornographique, haineuse, ni contraire à la dignité des personnes.</li>
            </ul>
            <p>
                L&apos;auteur conserve ses droits sur la photo. Il autorise le Client à la conserver et à la partager dans un cadre privé,
                et nous autorise à l&apos;héberger et à l&apos;afficher aux personnes disposant du lien de l&apos;événement, uniquement pour
                fournir le service et pendant la durée de conservation prévue.
            </p>
            <p>
                Le Client peut supprimer toute photo depuis son espace, et activer la modération (pack {premium.label}). Toute photo peut être
                signalée via le bouton « Signaler » de la galerie ou par email ; nous retirons sans délai les contenus manifestement illicites
                qui nous sont signalés.
            </p>

            <h2>8. Programme partenaires</h2>
            <p>
                Les professionnels dont la candidature est acceptée reçoivent un lien personnel. Pour chaque pack payé par un client venu
                par ce lien (dans les 30 jours suivant sa visite), le partenaire perçoit une commission de 20 % du montant hors taxes, hors
                commande remboursée. Les commissions sont versées par virement, sur demande et sur facture du partenaire. Nous pouvons
                mettre fin à un partenariat en cas d&apos;abus (spam, auto-parrainage, fausse information).
            </p>

            <h2>9. Responsabilité</h2>
            <p>
                Nous mettons tout en œuvre pour assurer la disponibilité du service et la conservation des photos pendant la durée prévue
                (obligation de moyens). Le mode hors ligne dépend de l&apos;espace disponible sur le téléphone de l&apos;invité. Notre
                responsabilité ne saurait être engagée en cas d&apos;interruption due à un tiers (réseau, hébergeur, panne du téléphone),
                ni pour le contenu des photos envoyées par les invités. En tout état de cause, notre responsabilité est limitée au montant
                payé pour l&apos;événement concerné.
            </p>

            <h2>10. Suppression du compte</h2>
            <p>
                Le Client peut supprimer à tout moment un événement ou son compte depuis son espace. Les photos sont alors immédiatement
                et définitivement supprimées. Les factures sont conservées pendant la durée imposée par la loi (10 ans).
            </p>

            <h2>11. Données personnelles</h2>
            <p>Voir notre <a href="/confidentialite">politique de confidentialité</a>.</p>

            <h2>12. Modification des conditions</h2>
            <p>
                Nous pouvons modifier ces conditions. La version applicable à un événement est celle acceptée lors de sa création
                (la version et la date d&apos;acceptation sont enregistrées).
            </p>

            <h2>13. Litiges et médiation</h2>
            <p>
                Ces conditions sont soumises au droit français. En cas de litige, le Client consommateur peut, après une réclamation écrite
                restée sans réponse satisfaisante, recourir gratuitement au médiateur de la consommation : <F v={LEGAL.mediator.name} /> (<F v={LEGAL.mediator.website} />).
                À défaut d&apos;accord, les tribunaux français sont compétents.
            </p>
        </LegalPage>
    );
}
