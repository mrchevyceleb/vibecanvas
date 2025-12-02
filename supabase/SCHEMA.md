# Database Schema Documentation

This file documents the current database schema. **The remote Supabase instance is the source of truth.**

## Schema Source

- **Remote Database:** `https://xcjqilfhlwbykckzdzry.supabase.co`
- **Last Pulled:** See latest migration file timestamp in `migrations/`

## Pulling Latest Schema

To update this documentation with the latest schema from production:

```bash
npm run supabase:schema:pull
```

This will:
1. Connect to the remote Supabase database
2. Generate a new migration file with the current schema
3. Save it to `supabase/migrations/` with a timestamp

## Migration Files

All migration files are stored in `supabase/migrations/`. Each file represents a point-in-time snapshot or change to the database schema.

### Viewing Schema

To see the current schema:

1. **Check migration files:**
   ```bash
   ls supabase/migrations/
   ```

2. **View in Supabase Studio (local):**
   ```bash
   npm run supabase:start
   # Then visit http://localhost:54323
   ```

3. **View in Supabase Dashboard (remote):**
   - Visit: https://supabase.com/dashboard/project/xcjqilfhlwbykckzdzry/editor

## Schema Documentation

After pulling the schema, review the generated migration files to understand:
- Tables and their columns
- Indexes
- Foreign keys and relationships
- Functions and triggers
- Row Level Security (RLS) policies
- Extensions enabled

## Workflow

1. **Pull latest schema from remote:**
   ```bash
   npm run supabase:schema:pull
   ```

2. **Review the generated migration file**

3. **Make changes locally** (if needed)

4. **Create new migration for changes:**
   ```bash
   npm run supabase:migration:new my_changes
   ```

5. **Test locally:**
   ```bash
   npm run supabase:migration:up
   ```

6. **Deploy to remote:**
   ```bash
   npm run supabase:db:push
   ```

## Important Notes

- ⚠️ **Never edit existing migration files** that have been applied to production
- ✅ **Always pull before making changes** to ensure you're working with the latest schema
- ✅ **Create new migrations** for any schema changes
- ✅ **Test locally first** before deploying to production


