# VibeCanvas - Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed (for local testing)
4. **APIs enabled** in your GCP project:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API

## Environment Variables

**All API keys are now handled server-side via Supabase Edge Functions.** No secrets are required at build time!

| Variable | Description | Where Configured |
|----------|-------------|------------------|
| `FAL_KEY` | fal key sourced from Doppler `FAL_API_KEY` | Supabase Edge Function secrets |
| `SUPABASE_URL` | Supabase project URL | Supabase Edge Function (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Supabase Edge Function secrets |

## Quick Deploy (Manual)

### Option 1: Using gcloud CLI directly

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build and deploy in one command (no secrets needed!)
gcloud run deploy vibecanvas \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi
```

### Option 2: Using Cloud Build

```bash
# Submit build
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_REGION="us-central1"
```

### Option 3: Build Docker locally first

```bash
# Build the image (no secrets needed!)
docker build -t gcr.io/YOUR_PROJECT_ID/vibecanvas:latest .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/vibecanvas:latest

# Deploy to Cloud Run
gcloud run deploy vibecanvas \
  --image gcr.io/YOUR_PROJECT_ID/vibecanvas:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Local Docker Testing

```bash
# Build Docker image
docker build \
  --build-arg GEMINI_API_KEY="your-api-key" \
  -t vibecanvas .

# Run container
docker run -p 8080:8080 vibecanvas

# Visit http://localhost:8080
```

## CI/CD Setup (Automatic Deploys)

1. Go to Cloud Build > Triggers in GCP Console
2. Create a new trigger:
   - **Source**: Connect your GitHub repository
   - **Event**: Push to branch `main`
   - **Configuration**: Cloud Build configuration file (`cloudbuild.yaml`)
3. Add substitution variables:
   - `_GEMINI_API_KEY`: Your API key (use Secret Manager for production)
   - `_REGION`: `us-central1` (or your preferred region)

## Using Secret Manager (Recommended for Production)

```bash
# Create secret
echo -n "your-api-key" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Grant Cloud Build access
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Then update `cloudbuild.yaml` to use:
```yaml
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/GEMINI_API_KEY/versions/latest
      env: 'GEMINI_API_KEY'
```

## Supabase Edge Functions (Required)

**All AI API calls go through Supabase Edge Functions** to keep API keys secure. Deploy these before using the app:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref xcjqilfhlwbykckzdzry

# Deploy all edge functions
npm run supabase:functions:deploy:fal

# Set secrets for edge functions
# Sync FAL_API_KEY from Doppler to Supabase as FAL_KEY using Assistant MCP.
# See SUPABASE_DEPLOY.md. Supabase supplies its own auth credentials.
```

### Edge Function Architecture

| Function | Provider | Purpose |
|----------|----------|---------|
| `fal-media` | fal | Image/video generation, editing, background removal, queue status, cancellation |

## Troubleshooting

### Build fails with "npm ci" error
Make sure `package-lock.json` is committed to the repository.

### App shows blank page
Check browser console for errors. Common issues:
- API keys not set during build
- CORS issues with Supabase

### Images not loading
Verify Supabase storage bucket policies allow public access.

### Cloud Run returns 503
Check Cloud Run logs. Common causes:
- Container failed to start
- Port mismatch (must be 8080)
- Memory limit too low

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Cloud Run     │────▶│    Supabase     │
│   (Frontend)    │     │   (Auth + DB)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │              ┌────────▼────────┐
         │              │ Supabase Storage│
         │              │  (Images/Video) │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Google Gemini  │     │ Supabase Edge   │
│  (Nano Banana)  │     │   Functions     │
└─────────────────┘     │  - veo-video    │
                        │  - open-ai-image│
                        └─────────────────┘
```

## Cost Optimization

- Cloud Run scales to zero when not in use
- Set `--min-instances 0` for development
- Set `--min-instances 1` for production to avoid cold starts
- Use `--memory 256Mi` if 512Mi is too much

## Support

For issues, check:
1. Cloud Run logs: `gcloud run logs read vibecanvas`
2. Cloud Build history: GCP Console > Cloud Build > History
3. Browser developer console for frontend errors


## Current production deployment

The existing service is vibecanvas in project website-image-fetch, region europe-west1: https://vibecanvas-sn6sufxieq-ew.a.run.app. Deploy a revision with --no-traffic and a preview tag, verify it, then update traffic explicitly. The October 11, 2026 release uses revision vibecanvas-00011-huz. The shared fal catalog must remain in the Docker build context; only the edge handler is excluded.

The public URL is https://canvas.stonelabs.us. Cloudflare DNS points this hostname to Vercel, whose existing `vibecanvas` project serves the routing configuration in `vercel.json`. That configuration forwards the app and its assets to the Cloud Run service above, so Cloud Run releases also appear at the public URL. Vercel serves HTTPS for the public domain; its deployment does not build or host a second copy of the app. Only changes to `vercel.json` require a Vercel deployment. Retain `public/favicon.svg` when deploying the routing configuration so the configured output directory exists.

After any release, verify the public URL's JavaScript asset matches Cloud Run and check the signed-in image/video model menus at the public URL. The older Google domain mapping still exists but its HTTPS certificate has expired; do not point DNS at `ghs.googlehosted.com` without verifying certificate renewal first.
