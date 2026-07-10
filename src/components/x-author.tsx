import Image from "next/image";

import { cn } from "@/lib/utils";

/** Verified creator credit: X pfp to the left of the @handle, linked to x.com. */
export function XAuthor({
  handle,
  avatarUrl,
  size = 16,
  className,
}: {
  handle: string;
  avatarUrl?: string | null;
  /** Avatar edge in px; the handle text scales via className. */
  size?: number;
  className?: string;
}) {
  return (
    <a
      href={`https://x.com/${handle}`}
      target="_blank"
      rel="noreferrer"
      title="Verified via X"
      className={cn(
        "text-primary inline-flex min-w-0 items-center gap-1.5 hover:underline",
        className,
      )}
    >
      {avatarUrl && (
        <Image
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-full"
        />
      )}
      <span className="truncate">@{handle}</span>
    </a>
  );
}
