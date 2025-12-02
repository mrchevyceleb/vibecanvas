# Alternative Ways to Pull Schema (Without Docker)

The Supabase CLI `db pull` command requires Docker Desktop. If Docker isn't available, here are alternative methods:

## Option 1: Install Docker Desktop (Recommended)

1. **Install Docker Desktop for Windows:**
   - Download from: https://docs.docker.com/desktop/install/windows-install/
   - Install and start Docker Desktop
   - Then run: `npm run supabase:schema:pull`

## Option 2: Use Supabase Dashboard SQL Editor

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/xcjqilfhlwbykckzdzry/editor

2. **Run this query to get schema:**
   ```sql
   SELECT 
     'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
     string_agg(
       column_name || ' ' || 
       CASE 
         WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
         WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
         WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
         ELSE UPPER(data_type)
       END ||
       CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
       CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
       ', '
     ) || ');' as ddl
   FROM information_schema.columns c
   JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = c.table_schema
   WHERE c.table_schema = 'public'
   GROUP BY schemaname, tablename
   ORDER BY schemaname, tablename;
   ```

3. **Export the results and save as a migration file:**
   ```bash
   # Create migration file
   $timestamp = Get-Date -Format "yyyyMMddHHmmss"
   New-Item -Path "supabase/migrations/${timestamp}_remote_schema.sql" -ItemType File
   # Paste the SQL output into this file
   ```

## Option 3: Use pg_dump Directly (If PostgreSQL Tools Installed)

If you have PostgreSQL client tools installed:

```bash
# Get connection string from: Supabase Dashboard → Settings → Database → Connection string
# Use the "URI" format

pg_dump "postgresql://postgres.xcjqilfhlwbykckzdzry:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-acl \
  > supabase/migrations/$(Get-Date -Format "yyyyMMddHHmmss")_remote_schema.sql
```

## Option 4: Manual Schema Documentation

1. Go to Supabase Dashboard → Table Editor
2. Review each table structure
3. Manually create migration file documenting the schema

## Current Status

- ✅ Project linked: `xcjqilfhlwbykckzdzry`
- ✅ Logged in to Supabase CLI
- ❌ Docker Desktop not installed (required for `db pull`)

## Recommended Next Steps

1. **Install Docker Desktop** (easiest long-term solution)
2. **Or use Option 2** (Dashboard SQL Editor) for immediate schema pull
3. **Then run:** `npm run supabase:schema:pull` once Docker is available


