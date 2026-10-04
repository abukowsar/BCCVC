import type { Metadata } from "next";
import { Hind_Siliguri, Manrope } from "next/font/google";
import "./globals.css";

const hindSiliguri = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-bn", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-latin", display: "swap" });

export const metadata: Metadata = {
  title: "বিসিসি ভিডিও কনফারেন্সিং অপারেশন সেন্টার",
  description: "বাংলাদেশ কম্পিউটার কাউন্সিলের জেলা, উপজেলা ও ভার্চুয়াল সভা ব্যবস্থাপনা",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bn" data-scroll-behavior="smooth" className={`${hindSiliguri.variable} ${manrope.variable}`}><body>{children}</body></html>;
}
