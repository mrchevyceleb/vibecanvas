# VibeCanvas

AI-powered image and video generation app. Create stunning visuals with Gemini, GPT-Image, Veo, and Sora.

![License](https://img.shields.io/badge/License-MIT-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ecf8e)

---

## Features

- **Multi-Model Generation** - Gemini 3 Pro, GPT-Image-1.5, Veo 3.1, Sora 2
- **Image Generation** - High-quality AI images with customizable parameters
- **Video Generation** - AI-powered video creation from text prompts
- **Image Editor** - Edit and refine generated images
- **Asset Library** - Organize generated content into folders
- **Templates** - Save and reuse generation presets
- **Multiple Aspect Ratios** - Square, portrait, landscape, widescreen

---

## Supported Models

### Image Generation
| Model | Provider | Strengths |
|-------|----------|-----------|
| Gemini 3 Pro | Google | Photorealistic, fast |
| GPT-Image-1.5 | OpenAI | Creative, artistic |

### Video Generation
| Model | Provider | Strengths |
|-------|----------|-----------|
| Veo 3.1 | Google | High quality, realistic |
| Sora 2 | OpenAI | Cinematic, creative |

---

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- **State**: Zustand for global state management
- **AI**: Server-side API calls via Edge Functions (keeps API keys secure)

---

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- API keys for Google AI and/or OpenAI

### 1. Clone and Install

```bash
git clone https://github.com/mrchevyceleb/vibecanvas.git
cd vibecanvas
npm install
```

### 2. Configure Supabase

Create a Supabase project with two storage buckets:
- `images` - for generated/uploaded images
- `video` - for generated videos

Link your project:

```bash
npm run supabase:link
```

### 3. Set Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Deploy Edge Functions

```bash
supabase secrets set GOOGLE_API_KEY=your-key
supabase secrets set OPENAI_API_KEY=your-key

npm run supabase:functions:deploy:all
```

### 5. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Architecture

```
vibecanvas/
├── components/           # React UI components
├── store/               # Zustand state stores
│   ├── useGenerationStore.ts   # Generation progress
│   ├── useLibraryStore.ts      # Image/video records
│   ├── useSettingsStore.ts     # User preferences
│   └── useTemplatesStore.ts    # Generation templates
├── services/
│   └── imageProviders.ts       # AI provider registry
├── supabase/
│   └── functions/              # Edge Functions
└── types.ts                    # TypeScript definitions
```

---

## Routes

| Path | Description |
|------|-------------|
| `/` | Image generation |
| `/video` | Video generation |
| `/library` | Gallery of generated content |
| `/edit/:id` | Image editor |

---

## API Architecture

All AI API calls go through Supabase Edge Functions to keep API keys server-side:

```
User -> React App -> Edge Function -> AI Provider (Google/OpenAI)
                          |
                          v
                    Supabase Storage
```

---

## License

MIT License - feel free to use, modify, and distribute.

---

**Built by [Matt Johnston](https://mattjohnston.io)**

*Part of the Vibe Marketing open source toolkit.*
