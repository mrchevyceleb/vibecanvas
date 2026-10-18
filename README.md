# VibeCanvas

A creative workspace for images, video, and image editing. All generation uses fal through an authenticated Supabase Edge Function; media stays in the existing private Supabase library.

## Models

| Images | Video |
| --- | --- |
| Nano Banana 2 | Veo 3.1 |
| Nano Banana Pro | Veo 3.1 Fast |
| GPT Image 2.5 Flare | |
| GPT Image 2.5 Sunburst | |
| GPT Image 1.5 | Kling 2.6 |
| FLUX Schnell | Wan 2.6 |
| FLUX.2 | Hailuo 02 |
| Seedream 4.5 | PixVerse 5.5 |
| Ideogram 3 | |
| Qwen Image | |

Seven image models support reference editing. GPT Image 2.5 Flare and Sunburst use the existing fal key for generation and edits, with 1K/2K output and all supported image shapes. Previous OpenAI selections upgrade to Flare; GPT Image 1.5 remains available and older records keep their model labels. All six video models support image-to-video; Wan also accepts video references. Background removal uses fal Birefnet. Archived Sora records remain readable; Sora is no longer offered because its fal endpoint could not be verified.

## Workspace

- Separate image/video drafts, working presets, prompt dictation, and Ctrl/Cmd + Enter.
- Model-specific aspect ratios, resolutions, durations, negative prompts, seeds, and audio.
- Compare up to three models, with independent progress and partial success handling.
- Queue status and cancellation; generation continues while browsing within the app.
- Retry an interrupted request in the same tab using the saved fal job handle.
- Search, filter, favorite, sort, upload, move, and select creations in the library.
- Keyboard-accessible details, downloads, temporary sharing links, remixing, and editing.
- Responsive layouts and reduced-motion support.

## Run locally

Install dependencies with `npm install`, then run `npm run dev` and open http://localhost:3000.

The app defaults to the existing VibeCanvas Supabase project. For a different project, set these public values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Never put FAL_KEY or a service-role key in VITE_ variables. Deploy `fal-media` before releasing the frontend; see [deployment instructions](SUPABASE_DEPLOY.md). Existing library tables are unchanged; a server-only fal_submissions table prevents automatic duplicate submissions after lost responses. The privacy migration in supabase/migrations/20261011130000_private_media.sql makes media buckets private and scopes video access to its owner. It was applied through Assistant MCP. Previously copied public URLs no longer work; use the new temporary signed links.

## Extend the model catalog

Add an entry in `supabase/functions/_shared/falModels.ts`, confirm the official fal OpenAPI schema, and adapt `buildFalInput` if the model needs different fields. The model picker, editor availability, comparison list, and provider registry derive from that shared catalog. Redeploy the edge function and frontend together after changing it.

## Verification

`npx tsc --noEmit` checks the app. `npx --yes deno check supabase/functions/fal-media/index.ts` checks the edge function. The UX audit and session verification are recorded in [UX_AUDIT.md](UX_AUDIT.md).
