import { createHash, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db, identities } from "./db";
import { siteUrl } from "./site";

/**
 * Wallet-bound Twitter/X identity via "Sign in with X" — a thin OAuth 2.0
 * PKCE connector, no auth system. The wallet IS the account (proven
 * per-request via SIWX). Claiming mints a state + verifier bound to the
 * wallet and returns an x.com authorization URL; the user signs in in a
 * browser and the callback binds wallet → @handle from the OAuth profile.
 *
 * Requires an X developer app (developer.x.com): set X_OAUTH_CLIENT_ID
 * (and X_OAUTH_CLIENT_SECRET for confidential clients) and register
 * {BASE_URL}/api/identity/callback as the redirect URI.
 */

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";

export function oauthConfigured(): boolean {
  return Boolean(process.env.X_OAUTH_CLIENT_ID);
}

export function callbackUrl(): string {
  return `${siteUrl()}/api/identity/callback`;
}

export async function getIdentity(wallet: string) {
  const rows = await db()
    .select()
    .from(identities)
    .where(eq(identities.wallet, wallet.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/**
 * Start (or restart) a claim: mint state + PKCE verifier for the wallet and
 * return the x.com authorization URL to open in a browser. An existing
 * verified handle survives until the new sign-in succeeds.
 */
export async function startClaim(wallet: string): Promise<string> {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());

  await db()
    .insert(identities)
    .values({
      wallet: wallet.toLowerCase(),
      oauthState: state,
      oauthVerifier: verifier,
    })
    .onConflictDoUpdate({
      target: identities.wallet,
      set: { oauthState: state, oauthVerifier: verifier },
    });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_OAUTH_CLIENT_ID!,
    redirect_uri: callbackUrl(),
    // users.read alone cannot call /2/users/me — tweet.read is required too.
    scope: "users.read tweet.read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function findByOAuthState(state: string) {
  const rows = await db()
    .select()
    .from(identities)
    .where(eq(identities.oauthState, state))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Exchange the OAuth code for the signed-in user's handle.
 * Throws with a user-displayable message on any failure.
 */
export async function exchangeCodeForHandle(
  code: string,
  verifier: string,
): Promise<string> {
  const clientId = process.env.X_OAUTH_CLIENT_ID!;
  const secret = process.env.X_OAUTH_CLIENT_SECRET;
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  // Confidential clients authenticate with Basic auth; public clients
  // (no secret) pass client_id in the body only.
  if (secret) {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
  }
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: callbackUrl(),
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`X sign-in could not be completed (${tokenRes.status})`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("X sign-in returned no access token");

  const meRes = await fetch(ME_URL, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!meRes.ok) throw new Error(`Could not read X profile (${meRes.status})`);
  const me = (await meRes.json()) as { data?: { username?: string } };
  if (!me.data?.username) throw new Error("X profile has no username");
  return me.data.username;
}

/** Bind wallet → @handle and clear the pending OAuth state. */
export async function markVerified(
  wallet: string,
  handle: string,
): Promise<void> {
  await db()
    .update(identities)
    .set({
      twitterHandle: handle.replace(/^@/, ""),
      verified: true,
      verifiedAt: new Date(),
      oauthState: null,
      oauthVerifier: null,
    })
    .where(eq(identities.wallet, wallet.toLowerCase()));
}
