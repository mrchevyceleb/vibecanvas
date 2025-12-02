# PowerShell script to pull database schema from remote Supabase instance
# This ensures local migrations reflect the production database

Write-Host "🔍 Pulling schema from remote Supabase instance..." -ForegroundColor Cyan
Write-Host ""

# Check if we need to link first
$configPath = Join-Path $PSScriptRoot ".supabase\config.toml"
if (-not (Test-Path $configPath)) {
    Write-Host "⚠️  Project not linked. You'll need to link first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Link interactively (recommended)" -ForegroundColor Green
    Write-Host "  npx supabase login" -ForegroundColor Gray
    Write-Host "  npx supabase link --project-ref xcjqilfhlwbykckzdzry" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Use database connection string" -ForegroundColor Green
    Write-Host "  Get connection string from: Supabase Dashboard → Settings → Database → Connection string" -ForegroundColor Gray
    Write-Host "  Then run: npx supabase db pull --db-url 'your_connection_string'" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "📥 Pulling schema from remote database..." -ForegroundColor Cyan
npx supabase db pull

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Schema pulled successfully!" -ForegroundColor Green
    Write-Host "📝 Review the new migration file in supabase/migrations/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To apply this locally: npm run supabase:migration:up" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Failed to pull schema. Make sure you're logged in:" -ForegroundColor Red
    Write-Host "  npx supabase login" -ForegroundColor Gray
}


