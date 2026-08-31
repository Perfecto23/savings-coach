import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { getPublicCopy } from "@/lib/i18n/public-presentation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const copy = getPublicCopy(await getRequestLocale()).metadata;
  return {
    title: { default: copy.title, template: copy.template },
    description: copy.description,
    icons: {
      icon: [
        {
          url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>",
          type: "image/svg+xml",
        },
      ],
    },
    openGraph: {
      title: copy.title,
      description: copy.openGraphDescription,
      type: "website",
      locale: copy.openGraphLocale,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f97316",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
