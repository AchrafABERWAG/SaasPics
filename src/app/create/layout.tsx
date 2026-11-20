import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Créer mon événement',
  description: 'Créez votre galerie photo de mariage en deux minutes : un QR code, et vos invités partagent leurs photos en direct.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
