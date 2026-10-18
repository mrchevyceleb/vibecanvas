# Supabase backend

VibeCanvas uses Supabase Auth, private `images` / `video` buckets, and the existing image_records, folders, and templates tables. The remote database remains the source of truth; pull its schema before preparing a migration.

All active media models use the authenticated `fal-media` queue proxy. The shared catalog is `functions/_shared/falModels.ts`. Deployment, secret routing, security, and rollout instructions are in [SUPABASE_DEPLOY.md](../SUPABASE_DEPLOY.md).

For local services, use `npm run supabase:start`, `npm run supabase:status`, and `npm run supabase:stop`. The SQL/schema guides in this directory describe database maintenance. The privacy migration was applied through Assistant MCP; it changes storage visibility and video policies. A server-only fal_submissions ledger reserves paid requests before contacting fal. All three October 11 migrations were applied through Assistant MCP.

The third migration adds atomic generation limits, durable callback recovery, and record/folder ownership enforcement. Only fal-media remains deployed; the legacy endpoints and their Supabase provider secrets were retired.
