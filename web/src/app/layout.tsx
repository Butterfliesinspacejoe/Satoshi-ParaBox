import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Satoshi's ParaBox | Secure Identity & Data Vault",
  description: "A secure, decentralized data vault and HIPAA-compliant communication portal utilizing World ID, ENS, Walrus Protocol, and Hedera Consensus Service.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
