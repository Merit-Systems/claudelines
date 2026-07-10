CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statusline_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"wallet" text,
	"amount_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statuslines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"author" text DEFAULT 'anonymous' NOT NULL,
	"author_wallet" text,
	"price_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"spec" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"revenue_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statuslines_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_statusline_id_statuslines_id_fk" FOREIGN KEY ("statusline_id") REFERENCES "public"."statuslines"("id") ON DELETE cascade ON UPDATE no action;