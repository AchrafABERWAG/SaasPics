'use client';

import { useEffect, useState } from 'react';

// Barre de navigation de l'accueil : fond opaque dès que l'on fait défiler la page.
// Seul ce petit composant s'exécute dans le navigateur ; le reste de l'accueil est rendu par le serveur.
export default function ScrollNav({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <nav className={`romance-nav${scrolled ? ' scrolled' : ''}`}>{children}</nav>;
}
