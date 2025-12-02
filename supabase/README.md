# Supabase Setup and Deployment Guide

This directory contains the Supabase configuration, edge functions, and database migrations for the VibeCanvas project.

## ⚠️ Important: Remote Database is Source of Truth

**The remote Supabase instance is the single source of truth for the database schema.** Always pull schema changes from the remote before making local modifications. This ensures migrations accurately reflect production.

## Prerequisites

1. Install the Supabase CLI:
   ```bash
   npm install
   ```

2. Login to Supabase:
   ```bash
   npx supabase login
   ```

3. Link your project (already configured for project: `xcjqilfhlwbykckzdzry`):
   ```bash
   npm run supabase:link
   ```

## Local Development

### Start Local Supabase Instance

```bash
npm run supabase:start
```

This will start all Supabase services locally:
- PostgreSQL database on port `54322`
- Supabase Studio on port `54323`
- API server on port `54321`
- Inbucket (email testing) on port `54324`

### Stop Local Instance

```bash
npm run supabase:stop
```

### Check Status

```bash
npm run supabase:status
```

## Database Migrations

### ⚠️ Pull Remote Schema First (Source of Truth)

**Always start by pulling the current schema from the remote database:**

```bash
npm run supabase:db:pull
```

Or use the helper script:
- **Windows PowerShell:** `.\supabase\pull-schema.ps1`
- **Bash/Unix:** `bash supabase/pull-schema.sh`

This creates a migration file reflecting the current remote database state. The remote Supabase instance is the single source of truth.

**Prerequisites for pulling:**
1. Login to Supabase CLI:
   ```bash
   npx supabase login
   ```

2. Link your project (if not already linked):
   ```bash
   npm run supabase:link
   ```
   You'll need your database password from: Supabase Dashboard → Settings → Database

### Create a New Migration

After pulling the remote schema, create new migrations for changes:

```bash
npm run supabase:migration:new migration_name
```

This creates a new migration file in `supabase/migrations/` with a timestamp.

### Apply Migrations

**To local database:**
```bash
npm run supabase:migration:up
```

**To remote database:**
```bash
npm run supabase:db:push
```

### Pull Remote Schema Changes

If you make changes directly in the Supabase dashboard, pull them locally:

```bash
npm run supabase:db:pull
```

This creates a new migration file with the differences.

### Reset Local Database

```bash
npm run supabase:reset
```

⚠️ **Warning:** This will delete all local data and reapply all migrations.

## Edge Functions

### Deploy All Functions

```bash
npm run supabase:functions:deploy:all
```

### Deploy Individual Functions

**Gemini Image Generation:**
```bash
npm run supabase:functions:deploy:gemini
```

**OpenAI Image Generation:**
```bash
npm run supabase:functions:deploy:openai
```

**Veo Video Generation:**
```bash
npm run supabase:functions:deploy:veo
```

### Deploy Custom Function

```bash
npm run supabase:functions:deploy function_name
```

## Environment Variables

Edge functions require the following environment variables to be set in your Supabase project:

1. Go to your Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add the following secrets:

   - `GOOGLE_API_KEY` - Your Google API key for Gemini and Veo
   - `OPENAI_API_KEY` - Your OpenAI API key for GPT-Image-1
   - `SUPABASE_URL` - Your Supabase project URL (automatically available)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (automatically available)

### Setting Secrets via CLI

```bash
# Set a secret
npx supabase secrets set GOOGLE_API_KEY=your_key_here

# List all secrets
npx supabase secrets list
```

## Project Structure

```
supabase/
├── config.toml          # Supabase CLI configuration
├── migrations/          # Database migration files
├── functions/           # Edge functions
│   ├── gemini-image/
│   ├── open-ai-image/
│   └── veo-video/
└── schema.sql          # Database schema (legacy, use migrations instead)
```

## Common Workflows

### Initial Setup

1. Link to remote project:
   ```bash
   npm run supabase:link
   ```

2. Pull existing schema:
   ```bash
   npm run supabase:db:pull
   ```

3. Set environment variables/secrets

4. Deploy edge functions:
   ```bash
   npm run supabase:functions:deploy:all
   ```

### Making Database Changes

1. Create a new migration:
   ```bash
   npm run supabase:migration:new add_new_table
   ```

2. Edit the migration file in `supabase/migrations/`

3. Test locally:
   ```bash
   npm run supabase:migration:up
   ```

4. Deploy to remote:
   ```bash
   npm run supabase:db:push
   ```

### Updating Edge Functions

1. Make changes to function code in `supabase/functions/`

2. Deploy the function:
   ```bash
   npm run supabase:functions:deploy:gemini  # or other function name
   ```

## Troubleshooting

### Functions Not Deploying

- Ensure you're logged in: `npx supabase login`
- Check project link: `npx supabase projects list`
- Verify function names match directory names

### Migration Issues

- Check migration files are valid SQL
- Ensure migrations are applied in order
- Use `supabase:db:pull` to sync with remote if needed

### Local Development Issues

- Reset local database: `npm run supabase:reset`
- Check service status: `npm run supabase:status`
- Restart services: `npm run supabase:stop && npm run supabase:start`

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)

