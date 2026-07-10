/**
 * Seed the database with the built-in statusline catalog.
 * Run after `pnpm db:push`:  pnpm db:seed
 */
import "dotenv/config";

import { db, statuslines } from "./index";
import { SEED_STATUSLINES } from "./seed-data";

async function main() {

  for (const s of SEED_STATUSLINES) {
    await db()
      .insert(statuslines)
      .values({
        slug: s.slug,
        name: s.name,
        description: s.description,
        author: s.author,
        priceUsd: s.priceUsd,
        spec: s.spec,
        tags: s.tags,
        installs: s.installs,
        featured: s.featured,
      })
      .onConflictDoNothing({ target: statuslines.slug });
    console.log(`seeded ${s.slug}`);
  }
}

main().then(() => {
  console.log("done");
  process.exit(0);
});
