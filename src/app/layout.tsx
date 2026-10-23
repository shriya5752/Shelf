import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const site = process.env.NEXT_PUBLIC_SITE_URL;
const title = "Shelf — your watchlist, as a library";
const description = "Search any movie or series, add it, and watch your own 3D library fill up.";

export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title,
  description,
  authors: [{ name: "Shriya" }],
  openGraph: { title, description, siteName: "Shelf", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
