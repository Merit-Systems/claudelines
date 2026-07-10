import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db, identities } from "./db";

/**
 * Wallet-bound Twitter/X identity.
 *
 * The wallet IS the account (proven per-request via SIWX). Attaching a
 * Twitter handle works like domain verification: we issue a code, the user
 * posts it in a tweet from the claimed handle, we read the tweet back and
 * bind wallet → @handle. Listings registered by a verified wallet display
 * the handle; everything else displays as unclaimed.
 */

export const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export async function getIdentity(wallet: string) {
  const rows = await db()
    .select()
    .from(identities)
    .where(eq(identities.wallet, wallet.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function startClaim(wallet: string, handle: string) {
  const code = `claudelines-${randomBytes(4).toString("hex")}`;
  const [row] = await db()
    .insert(identities)
    .values({
      wallet: wallet.toLowerCase(),
      twitterHandle: handle.replace(/^@/, ""),
      code,
      verified: false,
      verifiedAt: null,
    })
    .onConflictDoUpdate({
      target: identities.wallet,
      set: {
        twitterHandle: handle.replace(/^@/, ""),
        code,
        verified: false,
        verifiedAt: null,
      },
    })
    .returning();
  return row;
}

export async function markVerified(wallet: string) {
  await db()
    .update(identities)
    .set({ verified: true, verifiedAt: new Date() })
    .where(eq(identities.wallet, wallet.toLowerCase()));
}

/** Extract a tweet id from an x.com / twitter.com status URL. */
export function tweetIdFromUrl(url: string): string | null {
  const m = url.match(
    /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d{5,25})/,
  );
  return m?.[1] ?? null;
}

/**
 * Fetch a tweet without API keys via Twitter's syndication endpoint (the
 * same one react-tweet uses). Returns text + author screen name.
 */
export async function fetchTweet(
  id: string,
): Promise<{ text: string; screenName: string } | null> {
  // The endpoint requires a "token" derived from the id (public algorithm).
  const token = ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
  const res = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`,
    { headers: { "user-agent": "Mozilla/5.0 (compatible; claudelines)" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    text?: string;
    user?: { screen_name?: string };
  };
  if (!data?.text || !data?.user?.screen_name) return null;
  return { text: data.text, screenName: data.user.screen_name };
}
