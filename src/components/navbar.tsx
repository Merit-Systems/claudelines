import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

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
          <nav className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Docs
            </Link>
          </nav>
        </div>
        <Link href="/">
          <Button size="sm">Submit yours</Button>
        </Link>
      </div>
    </header>
  );
}
