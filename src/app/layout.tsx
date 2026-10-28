import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import { getPublicEnv } from "@/lib/env";
import { SkipLink } from "@/components/ui/skip-link";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bn", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_APP_URL),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={`${sans.variable} ${display.variable} ${bengali.variable}`}>
      <body className="font-sans">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
