# Guide: Pulling Database Schema from Remote Supabase

## Overview

The **remote Supabase instance is the single source of truth** for the database schema. This guide walks you through pulling the current schema from production to your local migrations directory.

## Step-by-Step Instructions

### Step 1: Login to Supabase CLI

```bash
npx supabase login
```

This will:
- Open your browser
- Prompt you to login with your Supabase account
- Authorize the CLI to access your projects

### Step 2: Link Your Project

```bash
npx supabase link --project-ref xcjqilfhlwbykckzdzry
```

You'll be prompted for:
- **Database password**: Get this from Supabase Dashboard → Settings → Database → Database password

Alternatively, if you have the connection string:
```bash
npx supabase db pull --db-url "postgresql://postgres:[PASSWORD]@db.xcjqilfhlwbykckzdzry.supabase.co:5432/postgres"
```

Replace `[PASSWORD]` with your actual database password.

### Step 3: Pull the Schema

Once linked, pull the schema:

```bash
npm run supabase:schema:pull
```

Or directly:
```bash
npx supabase db pull
```

This will:
- Connect to your remote database
- Analyze the current schema
- Generate a new migration file in `supabase/migrations/`
- The file will be named with a timestamp like: `YYYYMMDDHHMMSS_remote_schema.sql`

### Step 4: Review the Generated Migration

Check the new migration file:
```bash
# Windows PowerShell
Get-Content supabase\migrations\*.sql | Select-Object -Last 1

# Or open in your editor
code supabase/migrations/
```

The migration file will contain:
- All tables and their columns
- Indexes
- Foreign keys
- Functions and triggers
- Row Level Security policies
- Extensions

## Alternative: Using Connection String Directly

If you prefer not to link the project, you can pull directly using a connection string:

1. Get your connection string from: **Supabase Dashboard → Settings → Database → Connection string**
2. Use the "URI" format (not "Session mode")
3. Run:

```bash
npx supabase db pull --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.xcjqilfhlwbykckzdzry.supabase.co:5432/postgres"
```

**Note:** URL-encode special characters in the password if needed.

## What Gets Pulled

The `db pull` command captures:
- ✅ Table definitions (CREATE TABLE)
- ✅ Column types and constraints
- ✅ Indexes
- ✅ Foreign key relationships
- ✅ Sequences
- ✅ Functions and triggers
- ✅ Row Level Security (RLS) policies
- ✅ Extensions

It does **NOT** capture:
- ❌ Data (only schema)
- ❌ Storage buckets (use `supabase storage` commands)
- ❌ Edge functions (already in `supabase/functions/`)

## Troubleshooting

### "Unauthorized" Error
- Make sure you're logged in: `npx supabase login`
- Verify your account has access to the project

### "Connection refused" or "Password incorrect"
- Double-check your database password
- Ensure you're using the correct project reference
- Try using the connection string method instead

### "No changes detected"
- This means your local migrations already match the remote schema
- Check if you have unapplied migrations: `npx supabase migration list`

### Migration File Not Created
- Check that `supabase/migrations/` directory exists
- Verify write permissions
- Check CLI output for errors

## Next Steps

After pulling the schema:

1. **Review the migration file** to understand the current schema
2. **Document any important notes** in `supabase/SCHEMA.md`
3. **Make local changes** (if needed) by creating new migrations
4. **Test locally** before deploying changes

## Automated Scripts

We've provided helper scripts:

- **Windows:** `supabase/pull-schema.ps1`
- **Unix/Mac:** `supabase/pull-schema.sh`

These scripts automate the linking and pulling process.

## Important Reminders

- ⚠️ **Always pull before making schema changes** to ensure you're working with the latest state
- ⚠️ **Never edit migration files** that have been applied to production
- ✅ **Create new migrations** for any changes you want to make
- ✅ **Test locally first** using `npm run supabase:start` and `npm run supabase:migration:up`


