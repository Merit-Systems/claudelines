import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/statuslines", label: "Browse" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <p className="text-sm font-medium">
              statuslines<span className="text-muted-foreground">.dev</span>
            </p>
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link href="/docs#sell">
          <Button size="sm">Sell yours</Button>
        </Link>
      </div>
    </header>
  );
}
