CREATE TABLE "identities" (
	"wallet" text PRIMARY KEY NOT NULL,
	"twitter_handle" text NOT NULL,
	"code" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
