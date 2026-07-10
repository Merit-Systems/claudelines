import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Local development only: route the Neon HTTP driver at a local proxy
// (e.g. timowilhelm/local-neon-http-proxy). Unset in production.
if (process.env.NEON_HTTP_PROXY) {
  neonConfig.fetchEndpoint = process.env.NEON_HTTP_PROXY;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — provision Neon via the Vercel integration and pull env vars.",
    );
  }
  return drizzle(neon(url), { schema });
}

/** Lazy singleton so importing modules never throws at build time. */
let _db: ReturnType<typeof createDb> | null = null;

export function db() {
  _db ??= createDb();
  return _db;
}

export * from "./schema";
