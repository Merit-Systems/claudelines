/** Three statusline segments — the mark adopts the theme's primary green. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className ?? "size-5 shrink-0"}
      aria-hidden
    >
      <rect x="1" y="9" width="9" height="6" rx="1.5" fill="var(--primary)" />
      <rect
        x="12"
        y="9"
        width="6"
        height="6"
        rx="1.5"
        fill="color-mix(in oklch, var(--primary), var(--background) 55%)"
      />
      <rect
        x="20"
        y="9"
        width="3"
        height="6"
        rx="1.5"
        fill="color-mix(in oklch, var(--primary), var(--background) 75%)"
      />
    </svg>
  );
}
