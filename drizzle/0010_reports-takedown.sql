CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statusline_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "red_flags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "report_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_statusline_id_statuslines_id_fk" FOREIGN KEY ("statusline_id") REFERENCES "public"."statuslines"("id") ON DELETE cascade ON UPDATE no action;