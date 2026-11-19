import type { Metadata } from 'next';
import LegalPage, { F } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: `Mentions légales — ${LEGAL.brand}` };

export default function MentionsLegalesPage() {
    return (
        <LegalPage title="Mentions légales">
            <h2>Éditeur du site</h2>
            <p>
                Le service {LEGAL.brand} est édité par <F v={LEGAL.companyName} />, <F v={LEGAL.legalForm} />
                {LEGAL.shareCapital && <> au capital de {LEGAL.shareCapital}</>}.<br />
                SIRET : <F v={LEGAL.siret} />{LEGAL.rcs && <> — {LEGAL.rcs}</>}<br />
                {LEGAL.vatNumber ? <>N° de TVA intracommunautaire : {LEGAL.vatNumber}</> : <>TVA non applicable, article 293 B du CGI.</>}<br />
                Adresse : <F v={LEGAL.address} /><br />
                Contact : <F v={LEGAL.email} />{LEGAL.phone && <> — {LEGAL.phone}</>}
            </p>
            <p>Directeur de la publication : <F v={LEGAL.publicationDirector} /></p>

            <h2>Hébergement</h2>
            <p>
                Site : <F v={LEGAL.host.name} />, <F v={LEGAL.host.address} />.<br />
                Données et photos : Supabase Inc. (sous-traitant), serveurs situés en <F v={LEGAL.dataRegion} />.
            </p>

            <h2>Propriété intellectuelle</h2>
            <p>
                Les éléments du site (textes, interface, logo, code) sont la propriété de l&apos;éditeur et ne peuvent être reproduits sans autorisation.
                Les photos envoyées par les invités restent la propriété de leurs auteurs (voir les <a href="/cgv">CGV / CGU</a>).
            </p>

            <h2>Signaler un contenu illicite</h2>
            <p>
                Chaque photo de la galerie peut être signalée via le bouton « Signaler ». Vous pouvez aussi écrire à <F v={LEGAL.email} /> en
                précisant l&apos;adresse de la page concernée et la raison du signalement. Les contenus manifestement illicites sont retirés
                dans les meilleurs délais.
            </p>

            <h2>Données personnelles</h2>
            <p>Voir notre <a href="/confidentialite">politique de confidentialité</a>.</p>
        </LegalPage>
    );
}
