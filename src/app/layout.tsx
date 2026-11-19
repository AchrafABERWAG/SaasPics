import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/components/AppProviders";

// We use standard HTML link for Google Fonts to ensure they load reliably without Vercel Font optimization issues locally
// Plus it allows us to easily tweak weights in one place.
export const metadata: Metadata = {
  title: "Saas Photo - Mariage",
  description: "Partagez vos photos en direct",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:wght@300;400;600&family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        <AppProviders />
      </body>
    </html>
  );
}
