import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/400-italic.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/jetbrains-mono/700-italic.css";

import { Navbar } from "@/components/navbar";
import { PreviewThemeProvider } from "@/components/preview-theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteUrl } from "@/lib/site";

import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "ClaudeLines",
  description:
    "Share, discover, and install audited Claude Code status line scripts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        <TooltipProvider>
          <PreviewThemeProvider>
            <div className="flex min-h-svh flex-col">
              <Navbar />
              <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-12">
                {children}
              </main>
              <footer className="border-t border-border/40">
                <div className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-6 text-center text-[11px] whitespace-nowrap sm:text-xs">
                  <p>
                    Review scripts before installing.{" "}
                    Our{" "}
                    <a
                      href="/docs#checks"
                      className="hover:text-foreground underline underline-offset-2"
                    >
                      checks
                    </a>{" "}
                    · Made with malice by{" "}
                    <a
                      href="https://x.com/rsproule"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground underline underline-offset-2"
                    >
                      @rsproule
                    </a>
                  </p>
                </div>
              </footer>
            </div>
          </PreviewThemeProvider>
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
