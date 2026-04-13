import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: `${siteConfig.name} RSS Feed` },
      ],
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: siteConfig.name,
    url: siteConfig.url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="border-b border-border">
            <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight">
                PaintLater Blog
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="hover:underline">
                  포스트
                </Link>
                <Link href="/tags" className="hover:underline">
                  태그
                </Link>
                <Link href="/search" className="hover:underline">
                  검색
                </Link>
                <Link href="/about" className="hover:underline">
                  소개
                </Link>
                <a
                  href="/feed.xml"
                  className="hover:underline"
                  aria-label="RSS 피드"
                >
                  RSS
                </a>
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border">
            <div className="mx-auto max-w-3xl px-6 py-6 text-sm text-muted-foreground">
              © {new Date().getFullYear()} PaintLater Blog
            </div>
          </footer>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
