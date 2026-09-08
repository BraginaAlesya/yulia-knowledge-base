import type { Metadata } from "next";
import { Literata, Manrope } from "next/font/google";
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
  title: "База знаний Юлии",
  description: "Админ-панель базы знаний пространства «Дом телесной устойчивости».",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${literata.variable} h-full antialiased`}
    >
      <body className={`${manrope.className} min-h-full`}>{children}</body>
    </html>
  );
}
