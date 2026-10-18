# fal deployment

Project: `xcjqilfhlwbykckzdzry` (VibeCanvas). Doppler routing: workplace `personal`, project `vibecanvas`, config `prd`.

## Secret

Use Assistant MCP Doppler to read `FAL_API_KEY` through a one-time `secret_link`. Redeem it directly into an ignored file or process environment. Use Assistant MCP `supabase_set_secrets` with explicit `account: personal` and this project reference to configure `FAL_KEY`. Never print the key or commit it. Verify the Supabase secret digest matches the source.

Supabase already supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Configure FAL_JOB_SIGNING_KEY independently of FAL_KEY from Doppler personal/vibecanvas/prd; it keeps paid handles valid when the provider key rotates. Supabase also supplies SUPABASE_SERVICE_ROLE_KEY: only the server uses it for the private fal_submissions reservation ledger. References are signed using the requesting user's authenticated session and storage policies.

## Function deployment

Apply all three October 11 migrations before deployment. They are already applied to production through Assistant MCP.

`npm run supabase:functions:deploy:fal` deploys `fal-media` with the project reference and `--no-verify-jwt`. The function itself verifies every bearer token with Supabase Auth before accessing fal. `supabase/config.toml` also records this setting. The source imports `../_shared/falModels.ts`; include that file when deploying through the Dashboard editor.

The Assistant MCP currently exposes secret management and function inspection, but no function deployment operation. A CLI session with a Supabase Management API token, or the Supabase Dashboard editor, is required to upload the function. Do not assume setting the secret deploys the code.

Deploy and verify the function **before** publishing the new frontend. An unauthenticated POST must return 401. Then run an authenticated image smoke test and verify saved output, queue status, and cancellation. Video generation is billable; verify its payloads against fal schemas before initiating paid video tests.

## API

All requests are authenticated POSTs to `/functions/v1/fal-media`:

| Action | Body | Response |
| --- | --- | --- |
| submit | clientRequestId (UUID), modelId, params, optional operation: remove-background | jobToken, requestId, normalized params, or pending confirmation |
| status | jobToken | IN_QUEUE / IN_PROGRESS, or COMPLETED with media URLs |
| cancel | jobToken | cancellation response |

The server allowlists endpoints, restricts references to the user's storage prefix, and signs job handles with HMAC. Status/cancel handles belong to one user and expire after 24 hours. The browser polls and downloads results before saving them in private storage. The API key remains server-side.

The browser persists a client-generated UUID before submitting. The server atomically reserves each user/UUID in the server-only fal_submissions table before calling fal. Repeating the same UUID returns its existing handle or pending confirmation without buying another job. Ambiguous submission failures stay reserved; completion callbacks restore accepted jobs even after the submit response or confirmation write is lost. Each callback carries a user/request-bound HMAC token and a fal ED25519 signature verified against fal's JWKS, including a five-minute timestamp window. Raw queue metadata is stored so handles can be re-signed. Transient 5xx failures keep the paid handle; only explicit permanent errors clear it. If every webhook delivery fails, the administrator can reconcile the retained request in fal history. The same tab retains accepted handles after polling, download, save, or uncertain cancellation failures; it removes them only after a successful save, explicit rejection or confirmed cancellation. Cancellation can stop queued work; a rendering request may still incur charges.

## Existing data and rollout

Existing library tables and storage paths are unchanged; the new server-only fal_submissions table records submission reservations. The privacy migration was applied via Assistant MCP: both media buckets are now private, and video SELECT/INSERT policies require an owner-prefixed path. Previously copied public URLs no longer work; signed previews and newly copied one-hour links continue to work. Legacy model identifiers remain readable. The old provider-specific function sources and deployment scripts were removed. The new frontend is live on Cloud Run revision vibecanvas-00011-huz in website-image-fetch / europe-west1. The five old endpoints (gemini-image, open-ai-image, veo-video, sora-video, remove-background) and their six provider-specific Supabase secrets were removed after cutover. Only fal-media remains deployed. Original source keys remain in Doppler.

Production ownership audit found 853 linked images and 11 linked videos, all with valid owner paths. The 70 unowned, unreferenced legacy video objects remain private and retained for administrator reconciliation; no files were removed or assigned to a different user. The privacy migration validates linked paths and the scope of each legacy policy before changing access.

For a new project, create private `images` and `video` buckets and apply the existing authenticated ownership policies. The app and bucket limits are 20 MB per image and 50 MB per video. Generated downloads check Content-Length and enforce a streaming byte limit before saving; oversized or unsaved outputs expose a direct original-file link.

## Generation limits

The service-role-only reserve_fal_submission RPC checks limits and reserves a UUID in one locked transaction: 3 concurrent requests per user, 10 submissions per 10 minutes, 24 image and 4 video jobs per rolling 24 hours, and weighted per-user/global budgets of 40/100 units per day (image 1, video 10). These are workload caps rather than quoted prices or an exact dollar guarantee. Explicitly rejected jobs do not use the daily budget. The SQL migration is the source for changing limits. Completion callbacks and successful polling release concurrency. All source, table and RPC access remains server-only.

Database triggers enforce matching record/folder owners even for crafted clients. Storage migration rejects any unknown permissive media policy rather than assuming private buckets alone enforce isolation.

Webhook contract: [official fal documentation](https://fal.ai/docs/documentation/model-apis/inference/webhooks).
