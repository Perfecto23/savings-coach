import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getPublicCopy } from "@/lib/public/presentation";
import { APP_LOCALE } from "@/lib/product-locale";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const metadataCopy = getPublicCopy().metadata;

export const metadata: Metadata = {
    title: { default: metadataCopy.title, template: metadataCopy.template },
    description: metadataCopy.description,
    icons: {
      icon: [
        {
          url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>",
          type: "image/svg+xml",
        },
      ],
    },
    openGraph: {
      title: metadataCopy.title,
      description: metadataCopy.openGraphDescription,
      type: "website",
      locale: metadataCopy.openGraphLocale,
    },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={APP_LOCALE} data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
