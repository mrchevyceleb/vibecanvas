# Quick Supabase Deployment Reference

## First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Login to Supabase:**
   ```bash
   npx supabase login
   ```

3. **Link to your project:**
   ```bash
   npm run supabase:link
   ```

4. **Set environment secrets** (in Supabase Dashboard or via CLI):
   ```bash
   npx supabase secrets set GOOGLE_API_KEY=your_key_here
   npx supabase secrets set OPENAI_API_KEY=your_key_here
   ```

## Deploy Edge Functions

**Deploy all functions:**
```bash
npm run supabase:functions:deploy:all
```

**Or deploy individually:**
```bash
npm run supabase:functions:deploy:gemini
npm run supabase:functions:deploy:openai
npm run supabase:functions:deploy:veo
```

## Run SQL Migrations

**⚠️ IMPORTANT: Pull remote schema first (source of truth):**
```bash
npm run supabase:schema:pull
```

**Create a new migration:**
```bash
npm run supabase:migration:new migration_name
```

**Apply migrations to remote:**
```bash
npm run supabase:db:push
```

**Pull remote schema changes:**
```bash
npm run supabase:db:pull
```

## Local Development

**Start local Supabase:**
```bash
npm run supabase:start
```

**Stop local Supabase:**
```bash
npm run supabase:stop
```

**Reset local database:**
```bash
npm run supabase:reset
```

## Project Reference

- **Project ID:** `xcjqilfhlwbykckzdzry`
- **Supabase URL:** `https://xcjqilfhlwbykckzdzry.supabase.co`
- **Config:** `supabase/config.toml`
- **Functions:** `supabase/functions/`
- **Migrations:** `supabase/migrations/`

For detailed documentation, see [supabase/README.md](./supabase/README.md)

