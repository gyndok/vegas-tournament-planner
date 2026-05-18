import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  metadataBase: new URL("https://nextrebuy.com"),
  title: {
    default: "NextRebuy — Vegas Poker Tournament Planner",
    template: "%s · NextRebuy",
  },
  description:
    "Plan your Vegas poker trip. Browse WSOP, Wynn, Venetian, Aria, Venetian, Resorts World, and every major series. Build your schedule, track results, run Last Longer Pools with your crew, and get AI tournament recommendations — all free.",
  applicationName: "NextRebuy",
  keywords: [
    "Vegas poker tournaments",
    "WSOP schedule",
    "Wynn poker",
    "Venetian poker",
    "Aria poker",
    "Las Vegas poker series",
    "tournament planner",
    "last longer pool",
    "poker trip planner",
  ],
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "NextRebuy",
    title: "NextRebuy — Vegas Poker Tournament Planner",
    description:
      "Plan your Vegas poker trip. Browse every major series, build your schedule, run Last Longer Pools, and track your bankroll.",
    url: "/",
    images: [
      { url: "/logo.png", width: 1248, height: 832, alt: "NextRebuy" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NextRebuy — Vegas Poker Tournament Planner",
    description:
      "Plan your Vegas poker trip. Browse every major series, build your schedule, run Last Longer Pools, and track your bankroll.",
    images: ["/logo.png"],
    creator: "@gyndok",
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
        <meta name="google-adsense-account" content="ca-pub-8776426212698680" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8776426212698680"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
