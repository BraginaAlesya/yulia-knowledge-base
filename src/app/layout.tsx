import type { Metadata } from "next";
import { Literata, Manrope } from "next/font/google";
import PwaSetup from "@/components/pwa-setup";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: { default: "Взмах к себе", template: "%s · Взмах к себе" },
  description: "Личный кабинет пространства «Дом телесной устойчивости».",
  applicationName: "Взмах к себе",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Взмах к себе" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${literata.variable} h-full antialiased`}
    >
      <body className={`${manrope.className} min-h-full`}><PwaSetup />{children}</body>
    </html>
  );
}
