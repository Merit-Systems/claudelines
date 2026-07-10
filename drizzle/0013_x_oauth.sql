ALTER TABLE "identities" ALTER COLUMN "twitter_handle" DROP NOT NULL;
ALTER TABLE "identities" ADD COLUMN IF NOT EXISTS "oauth_state" text;
ALTER TABLE "identities" ADD COLUMN IF NOT EXISTS "oauth_verifier" text;
ALTER TABLE "identities" DROP COLUMN IF EXISTS "code";
CREATE UNIQUE INDEX IF NOT EXISTS "identities_oauth_state_unique"
  ON "identities" ("oauth_state");
