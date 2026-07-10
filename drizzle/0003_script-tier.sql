ALTER TABLE "statuslines" ALTER COLUMN "spec" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "kind" text DEFAULT 'spec' NOT NULL;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "script" text;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "preview_ansi" text;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "capabilities" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "audit_verdict" text;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "audit_summary" text;--> statement-breakpoint
ALTER TABLE "statuslines" ADD COLUMN "audit_model" text;