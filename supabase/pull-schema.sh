#!/bin/bash
# Script to pull database schema from remote Supabase instance
# This ensures local migrations reflect the production database

set -e

echo "🔍 Pulling schema from remote Supabase instance..."
echo ""

# Check if linked
if [ ! -f ".supabase/config.toml" ] && [ ! -f "../.supabase/config.toml" ]; then
    echo "⚠️  Project not linked. Linking now..."
    echo "You'll need your database password from Supabase Dashboard → Settings → Database"
    echo ""
    read -p "Enter your database password: " -s DB_PASSWORD
    echo ""
    
    npx supabase link --project-ref xcjqilfhlwbykckzdzry --password "$DB_PASSWORD"
fi

echo "📥 Pulling schema from remote database..."
npx supabase db pull

echo ""
echo "✅ Schema pulled successfully!"
echo "📝 Review the new migration file in supabase/migrations/"
echo ""
echo "To apply this locally: npm run supabase:migration:up"


