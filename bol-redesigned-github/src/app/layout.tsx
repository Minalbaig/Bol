import type { Metadata, Viewport } from "next";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bol — Keep your words. See what AI changed.",
  description: "A human-centered AI prototype for reviewing evidence-linked suggestions against your original words.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f5f7fb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
