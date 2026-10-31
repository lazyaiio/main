import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import { SkipLink } from "@/components/ui/skip-link";
import { rootMetadata } from "@/lib/services/seo";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bn", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata();
}

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
