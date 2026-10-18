# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build on port 8080
```

### Supabase Commands
```bash
npm run supabase:start           # Start local Supabase
npm run supabase:functions:deploy:all  # Deploy all edge functions
npm run supabase:functions:deploy:fal     # Deploy the unified fal queue proxy
npm run supabase:link            # Link to remote project
```

## Architecture Overview

VibeCanvas is a React + TypeScript AI media generation app using Vite, Tailwind CSS, and Supabase.

### Key Patterns

**State Management**: Zustand stores in `store/`:
- `useGenerationStore` - Generation progress/status
- `useLibraryStore` - Image/video records and folders (CRUD with Supabase)
- `useSettingsStore` - User preferences
- `useTemplatesStore` - Generation templates

**AI Provider System**: `services/imageProviders.ts` contains a registry of AI providers:
- Each provider implements `ImageProvider` interface from `types.ts`
- Providers call Supabase Edge Functions (not direct API calls)
- All active models use fal. The shared allowlist in `supabase/functions/_shared/falModels.ts` defines capabilities and payloads for eight image and six video models.

**Supabase Edge Functions**: `fal-media` verifies Supabase Auth and proxies fal submit/status/cancel requests. User-bound HMAC job tokens protect queue handles. `FAL_KEY` comes from Doppler workplace `personal`, project `vibecanvas`, config `prd` (`FAL_API_KEY`). The frontend never receives the key. See `SUPABASE_DEPLOY.md`.

**Storage**: Two Supabase buckets:
- `images` - for generated/uploaded images
- `video` - for generated videos

**Routing**: HashRouter with routes:
- `/` - Image generation (HomePage mode="image")
- `/video` - Video generation (HomePage mode="video")
- `/library` - Gallery of generated content
- `/edit/:id` - Image editor

### Type System

Core types in `types.ts`:
- `ModelId` - Union of supported model identifiers
- `ImageProvider` - Interface for AI providers with `generate()` method
- `ImageRecord` - Database record for generated media
- `GenParams` - Parameters passed to generation functions

### Configuration

- `constants.ts` - Model details, aspect ratios, resolutions, default templates
- `supabase/client.ts` - Supabase client initialization
- Path alias `@/*` maps to project root

### Authentication

Uses Supabase Auth via `hooks/useAuth.ts` with `AuthProvider` context. App requires authentication - unauthenticated users see `Auth` component.
