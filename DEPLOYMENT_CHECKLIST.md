# Deployment Checklist: Nano Banana Image Model Update

## Model Change: `gemini-2.0-flash-preview-image-generation` → `gemini-3.1-flash-image-preview`

### ✅ Code Changes (Completed)
- [x] `supabase/functions/gemini-image/index.ts` — Edge function updated to use `gemini-3.1-flash-image-preview`
- [x] `services/imageProviders.ts` — Frontend provider ID updated
- [x] `constants.ts` — Model details registry updated
- [x] `types.ts` — ModelId type updated
- [x] `store/useSettingsStore.ts` — Default model setting updated
- [x] `pages/EditorPage.tsx` — Model references updated
- [x] `pages/HomePage.tsx` — Model references updated
- [x] `pages/LibraryPage.tsx` — Model references updated

### ⚠️ Supabase Edge Function Redeployment (REQUIRED)
The `gemini-image` edge function **must be redeployed** to production for the model change to take effect server-side.

Run the following command from a machine with Supabase CLI access:

```bash
# If not already linked:
npx supabase link --project-ref xcjqilfhlwbykckzdzry

# Deploy the updated gemini-image function:
npm run supabase:functions:deploy:gemini
```

Or equivalently:
```bash
npx supabase functions deploy gemini-image --no-verify-jwt
```

### Verification
After deploying, test by generating an image. The response should include:
```json
{ "model": "gemini-3.1-flash-image-preview" }
```
