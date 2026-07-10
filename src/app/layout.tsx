import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: {
    default: "ClaudeLines — Claude Code statusline registry",
    template: "%s — ClaudeLines",
  },
  description:
    "A registry and leaderboard for Claude Code statuslines. Safe, data-only specs — install without running anyone's bash. Publish for $0.01, sell at your price.",
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
              <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 py-12">
                {children}
              </main>
              <footer className="border-t border-border/40">
                <div className="text-muted-foreground mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-6 text-xs">
                  <p>
                    statuslines are scripts — every one is audited, and we try
                    to catch the bad ones.{" "}
                    <a
                      href="/docs#safety"
                      className="hover:text-foreground underline underline-offset-2"
                    >
                      how
                    </a>
                  </p>
                  <div className="flex items-center gap-4">
                    <a href="/skill.md" className="hover:text-foreground">
                      skill.md
                    </a>
                    <a href="/llms.txt" className="hover:text-foreground">
                      llms.txt
                    </a>
                    <a href="/openapi.json" className="hover:text-foreground">
                      openapi.json
                    </a>
                  </div>
                </div>
              </footer>
            </div>
          </PreviewThemeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
