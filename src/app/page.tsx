import Link from 'next/link';

export default function Home() {
  return (
    <main className="landing-container">
      <h1 className="landing-title">📸 SaasPhoto</h1>
      <p style={{ color: '#ccc', fontSize: '1.2rem' }}>Partagez vos moments en direct.</p>
      <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
        <Link
          href="/event/demo-mariage"
          className="landing-btn"
        >
          Voir la Démo
        </Link>
        <Link
          href="/pricing"
          className="landing-btn"
          style={{ background: 'transparent', border: '1px solid white' }}
        >
          Voir les Tarifs
        </Link>
      </div>
    </main>
  );
}