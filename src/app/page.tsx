import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '2rem',
      textAlign: 'center' 
    }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>📸 SaasPhoto</h1>
      <p style={{ color: 'var(--secondary)' }}>Partagez vos moments en direct.</p>
      <Link 
        href="/event/mariage-test" 
        style={{
          background: 'var(--primary)',
          color: 'var(--background)',
          padding: '1rem 2rem',
          borderRadius: 'var(--radius-full)',
          textDecoration: 'none',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        Voir la Démo
      </Link>
    </main>
  );
}