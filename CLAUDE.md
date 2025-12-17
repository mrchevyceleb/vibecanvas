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
npm run supabase:functions:deploy:gemini   # Deploy Gemini image function
npm run supabase:functions:deploy:openai   # Deploy OpenAI image function
npm run supabase:functions:deploy:veo      # Deploy Veo video function
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
- Supports: Gemini 3 Pro (image), GPT-Image-1.5 (image), Veo 3.1 (video), Sora 2 (video)

**Supabase Edge Functions**: Located in `supabase/functions/` - these wrap external AI APIs (Google, OpenAI) to keep API keys server-side. Each function handles CORS and returns base64 images or video URLs.

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
