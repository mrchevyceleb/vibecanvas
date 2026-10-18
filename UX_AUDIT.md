# VibeCanvas UX audit and fal migration — October 11, 2026

Live: https://vibecanvas-sn6sufxieq-ew.a.run.app. Cloud Run project website-image-fetch / europe-west1, revision vibecanvas-00011-huz serves 100% of traffic. Supabase project xcjqilfhlwbykckzdzry now deploys only fal-media. Five old provider endpoints and six obsolete provider-specific Supabase secrets were retired after cutover. No commit or push was made.

## Product changes

| Finding | Delivered change |
| --- | --- |
| Dense, duplicated mobile form and unclear action | One responsive composer, model-aware settings, canvas and recent creations |
| Presets did not fill prompts; successful generation lost drafts | Real presets and separate per-user image/video drafts |
| Comparisons used stale parameters; errors lost partial results | Independent model requests, partial saves and retry only for unsaved models |
| Stopping hid UI without stopping work | Abort/cancel requests, honest charge feedback and recovery when cancellation is uncertain |
| Provider-specific APIs and limited choices | 8 image and 6 video models through fal; 5 image editing models and fal background removal |
| Initial-response loss could create a second paid job | Client UUID persisted before POST; atomic server reservation and signed completion callbacks |
| Lost confirmation could hide paid output | fal callbacks persist results and restore request handles without browser polling |
| Transient provider 5xx discarded paid handles | Preserve handles for transient failures; clear only explicit permanent failures |
| No billing controls | Atomic per-account concurrency, rate and daily limits, plus global weighted budget |
| Key rotation invalidated accepted jobs | Independent stable signing secret and stored raw queue metadata |
| Public files and permissive video policies | Private buckets, owner access on all four operations and full policy audit |
| Unbounded generated downloads | Header/stream size checks, 20 MB image / 50 MB video limits and direct file recovery links |
| Failed inserts/deletes orphaned files | Persist cleanup tasks; successful record deletion closes the dialog even if cleanup needs retry |
| Library depended on hover and lacked discovery | Search, mixed-media filters, sort, favorites, folders, selection and accurate partial bulk moves |
| Cross-account folder assignment possible | Database trigger validates record/folder ownership |
| Details lacked keyboard behavior | Native modal, Escape, focus restoration, downloads and one-hour signed sharing |
| Editor deep links failed | Direct-link loading, five editing models, cancellation and preservation of originals |
| Auth actions disrupted the app and hid sign-out errors | Separate initialization/action loading, account guards and visible errors |
| Previous results appeared with a failed new run | Clear results when a new run begins |
| Skip link navigated HashRouter | Focus main content directly before navigation controls |
| Docker excluded the shared model source | Include catalog in build context; exclude only edge handler |

## Verification

TypeScript and Deno checks passed. 435 payload combinations matched official fal OpenAPI schemas. Backend checks covered session validation, model allowlist, foreign references, tampered handles, duplicate UUIDs, ambiguous submissions, signed webhook recovery, provider-key rotation, transient 500 recovery, and quotas before any fal POST.

Desktop and 390px hosted-browser checks passed: model choices, capabilities, drafts/presets, comparisons/partial retry, queue progress, stopping, navigation, editor deep links, library search/selection, modal keyboard behavior, upload/cleanup and lost-submit recovery. Targeted checks also verified streaming size limits, sign-out failure feedback, partial moves, failed-insert cleanup and skip-link focus. No browser exceptions or horizontal overflow occurred; intentionally injected 5xx errors exercised recovery paths.

Live deployed checks passed using temporary accounts: fal image generation, duplicate UUID returning the same paid job, verified callback delivery without browser polling, private storage/library save, signed preview, cross-account job/file/record rejection, anonymous URL rejection, fal background removal, cancellation response, foreign-folder rejection and atomic 3-request concurrency enforcement. Temporary files, records, folders, accounts and reservations were removed after testing. Live video generation was not run; all supported video payloads were checked against official schemas.

Production audit: 853 linked images and 11 linked videos use valid owner paths. 70 unowned, unreferenced legacy video objects are preserved privately for administrator ownership reconciliation. No legacy files were deleted or reassigned. Previously copied public URLs no longer work; sharing now creates temporary signed links. FAL_KEY matches Doppler; the independent signing secret is stored in both Doppler and Supabase. No local secret files remain.

## Codex-fix review

Three reviews ran through direct Codex CLI: medium, medium, high. The reviewed scope grew from 39 files / 9,962 changed lines to 40 files / 10,500 changed lines (large tier). Review 1 raised 3 P0 and 6 P1; review 2 raised 2 P0 and 5 P1; review 3 raised 6 P0 and 3 P1. No fourth review was run. Final rollout corrections added the Docker context fix and a third SQL migration, giving 42 final files. Review 3 was not a clean review: its findings were addressed during rollout and checked with targeted/live verification rather than another review pass.

All findings and disposition:

| Review | Finding | Fix / verification |
| --- | --- | --- |
| 1 P0 | Cancellation discarded recoverable handles | Keep until confirmed cancelled; browser retry check |
| 1 P0 | Partial comparison repurchased successful models | Snapshot remaining models only; partial retry check |
| 1 P0 | Video ownership incomplete | All four storage operation policies, verified remotely |
| 1 P1 | Completed provider errors retried forever | Explicit permanent callback/status failures terminal; transient 5xx retained after review 3 |
| 1 P1 | Migration assumed existing policy names | Guarded fresh/repeat-safe migration |
| 1 P1 | Modal cleanup did not close/restore focus | Native dialog close and opener focus restoration |
| 1 P1 | Deleted-file cleanup silently failed | Persistent cleanup queue and retry UI |
| 1 P1 | Reference uploads became orphan files | Create managed library records |
| 1 P1 | Skip link followed header controls | First focusable element; HashRouter-safe focus |
| 2 P0 | Lost initial response caused duplicate billing | UUID reservation before fal; duplicate/lost-response checks |
| 2 P0 | Broad policy drops and legacy paths unaudited | Scope guards and production ownership audit; unowned files retained |
| 2 P1 | Failed-insert cleanup was ignored | Persist cleanup and verify failed-save retry |
| 2 P1 | Committed delete looked failed after cleanup failure | Warning and pending cleanup; dialog/selection close correctly |
| 2 P1 | Generated files downloaded without limits/recovery | Header and streaming cap; direct original link |
| 2 P1 | Bulk moves reported misleading partial success | allSettled results and one reconciled response |
| 2 P1 | Sign-out error hidden | Visible toast; authenticated UI retained |
| 3 P0 | Legacy endpoints allowed anonymous provider spending | Removed all five endpoints and unused provider secrets after live cutover |
| 3 P0 | Private bucket broke legacy Veo public URLs | Live frontend switched fully to fal; old Veo retired |
| 3 P0 | Unbounded authenticated billing | Atomic concurrency/rate/daily/weighted budget guards, verified live |
| 3 P0 | Lost acceptance confirmation unrecoverable | Verified ED25519/HMAC callbacks persist output and restore handles |
| 3 P0 | Transient completed-result 500 repurchased jobs | Keep handles; transient 500 recovery check |
| 3 P0 | Unknown permissive storage policy could bypass ownership | Audit/reject every remaining policy capable of media access |
| 3 P1 | Provider-key rotation invalidated job tokens | Stable signing key and raw metadata; rotation check |
| 3 P1 | Failed new run displayed stale prior results | Clear results at start |
| 3 P1 | Destination folder ownership unenforced | Database trigger; live foreign-folder update rejected |

No reviewer finding remains deliberately ignored. The last corrections have targeted/live verification; they have not received a fourth independent review. Callback delivery can still fail if fal and Supabase are both unavailable; retained ledger metadata allows administrator reconciliation. Weighted quotas cap workload rather than guaranteeing an exact dollar spend.

## Final file scope

- App.tsx
- components/Auth.tsx
- components/Header.tsx
- components/Lightbox.tsx
- components/UploadZone.tsx
- components/MediaCard.tsx
- constants.ts
- hooks/useAuth.ts
- hooks/useImageLoader.ts
- index.css
- index.html
- pages/EditorPage.tsx
- pages/HomePage.tsx
- pages/LibraryPage.tsx
- services/imageProviders.ts
- store/useGenerationStore.ts
- store/useLibraryStore.ts
- store/useSettingsStore.ts
- store/useTemplatesStore.ts
- types.ts
- lib/media.ts
- supabase/client.ts
- vite-env.d.ts
- supabase/functions/_shared/falModels.ts
- supabase/functions/fal-media/index.ts
- supabase/functions/gemini-image/index.ts
- supabase/functions/open-ai-image/index.ts
- supabase/functions/veo-video/index.ts
- supabase/functions/remove-background/index.ts
- package.json
- supabase/config.toml
- supabase/migrations/20261011130000_private_media.sql
- supabase/migrations/20261011140000_fal_submissions.sql
- public/favicon.svg
- README.md
- SUPABASE_DEPLOY.md
- supabase/README.md
- DEPLOY.md
- CLAUDE.md
- UX_AUDIT.md
- .dockerignore
- supabase/migrations/20261011150000_generation_limits_and_recovery.sql

Final scope: 42 files, 10901 changed lines (large tier). The three reviews used direct Codex CLI; all names are listed above. Production browser verification additionally passed real generation/save, private signed sharing, Escape behavior, six video choices and zero browser exceptions; its temporary account and media were removed.
