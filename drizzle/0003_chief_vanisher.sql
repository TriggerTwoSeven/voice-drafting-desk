CREATE TABLE IF NOT EXISTS "bot_sessions" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"mode" "session_mode" NOT NULL,
	"draft_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
-- NOTE: drizzle-kit generated a `DROP TABLE "sessions" CASCADE;` here, since
-- "sessions" no longer exists in our schema (renamed to "bot_sessions" to
-- avoid a name collision - see lib/db/schema.ts). That statement is
-- deliberately removed: "sessions" is a pre-existing table belonging to a
-- different, unrelated app that shares this Supabase project, not a table
-- this migration has ever owned - dropping it would destroy that app's data.