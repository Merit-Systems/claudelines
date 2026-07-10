DROP TABLE IF EXISTS "reports";--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statusline_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"wallet" text NOT NULL,
	"rating" integer,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_statusline_id_statuslines_id_fk" FOREIGN KEY ("statusline_id") REFERENCES "public"."statuslines"("id") ON DELETE cascade ON UPDATE no action;
