import {
  exchangeCodeForHandle,
  findByOAuthState,
  markVerified,
} from "@/lib/identity";

/**
 * "Sign in with X" OAuth callback — the browser half of the identity
 * connector. Static segments win over the /api/[[...route]] catch-all, so
 * this renders HTML instead of going through the agentcash router.
 */

export const dynamic = "force-dynamic";

const page = (title: string, body: string, ok: boolean) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:ui-monospace,monospace;background:#0a0a0a;color:#e5e5e5;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="max-width:28rem;padding:2rem;text-align:center">
<div style="font-size:2rem">${ok ? "✓" : "✗"}</div>
<h1 style="font-size:1.1rem">${title}</h1>
<p style="color:#a3a3a3;font-size:.9rem">${body}</p>
</div>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");

  if (denied) {
    return page("Sign-in cancelled", "No changes were made. Run the claim again to retry.", false);
  }
  if (!state || !code) {
    return page("Invalid callback", "Missing state or code parameter.", false);
  }

  const identity = await findByOAuthState(state);
  if (!identity?.oauthVerifier) {
    return page(
      "Unknown or expired claim",
      "This sign-in link was already used or superseded. Run the claim again for a fresh one.",
      false,
    );
  }

  try {
    const { handle, avatarUrl } = await exchangeCodeForHandle(
      code,
      identity.oauthVerifier,
    );
    // Listings credit the wallet's verified handle at read time — binding
    // the identity is all it takes.
    await markVerified(identity.wallet, handle, avatarUrl);
    return page(
      `Verified as @${handle}`,
      "Your listings now show you as the author. You can close this tab.",
      true,
    );
  } catch (err) {
    return page(
      "Verification failed",
      err instanceof Error ? err.message : "Unexpected error.",
      false,
    );
  }
}
