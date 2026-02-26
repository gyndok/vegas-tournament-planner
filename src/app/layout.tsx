import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextRebuy — Plan Your Grind",
  description:
    "AI-powered poker tournament scheduling for Las Vegas festivals",
  manifest: "/manifest.json",
  openGraph: {
    title: "NextRebuy — Plan Your Grind",
    description: "AI-powered poker tournament scheduling for Las Vegas festivals",
    images: [{ url: "/logo.png", width: 1248, height: 832 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <DashboardShell>
              {children}
            </DashboardShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
