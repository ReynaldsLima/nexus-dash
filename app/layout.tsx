import type { Metadata } from "next";
import { Syne, Bricolage_Grotesque, DM_Mono } from "next/font/google";
import "./globals.css";

import { TenantStoreProvider } from "@/lib/stores/tenant-store";
import { Providers } from "./providers";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NEXUS-DASH",
  description: "Plataforma de marketing analytics multi-tenant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${syne.variable} ${bricolage.variable} ${dmMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <TenantStoreProvider>{children}</TenantStoreProvider>
        </Providers>
      </body>
    </html>
  );
}
