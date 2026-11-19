'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoginAdmin from '@/components/auth/LoginAdmin';
import { BRAND } from '@/lib/brand';

export default function ProLoginPage() {
    const router = useRouter();
    return (
        <LoginAdmin
            title={BRAND.proName}
            subtitle="Espace partenaires"
            onLoginSuccess={() => router.push('/pro/dashboard')}
            footer={<>Pas encore partenaire ? <Link href="/pro/signup" style={{ color: 'var(--gold-primary)' }}>Envoyer une candidature</Link></>}
        />
    );
}
