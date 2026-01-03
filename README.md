# Break Free Content System

A complete automation system for generating daily Instagram carousel posts for "Break Free," a running brand that posts humorous, relatable running content with epic/surreal imagery.

## Features

- **Content Library Upload & Analysis**: Upload existing images and automatically extract captions using Claude's vision API
- **Brand Voice Profile**: Analyze your content library to learn your unique brand voice, tone, and style
- **Theme Generator**: Generate creative daily themes that match your brand aesthetic
- **Caption Generator**: Create 6 running-related captions per theme matching your proven brand voice
- **Dual Image Sourcing**:
  - **AI Image Generation**: DALL-E 3 for unique, generated images
  - **Stock Photos**: Pexels and Unsplash APIs (free)
- **Batch Generation**: Generate a full week of content at once
- **Review & Regeneration**: Regenerate individual captions or images
- **Export System**: Download images with captions as organized ZIP files

## Quick Start

### 1. Prerequisites

- Node.js 18+ 
- npm or yarn
- API Keys (see Configuration)

### 2. Installation

```bash
# Clone or copy the project
cd break-free-content-system

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your API keys
```

### 3. Configuration

Edit `.env.local` with your API keys:

```env
# REQUIRED: Claude API for caption/theme generation
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OPTIONAL: For AI image generation
OPENAI_API_KEY=your_openai_api_key_here

# OPTIONAL: For stock photos (both are free)
PEXELS_API_KEY=your_pexels_api_key_here
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

#### Getting API Keys

- **Anthropic (Claude)**: https://console.anthropic.com/
- **OpenAI (DALL-E)**: https://platform.openai.com/api-keys
- **Pexels**: https://www.pexels.com/api/ (free)
- **Unsplash**: https://unsplash.com/developers (free)

### 4. Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Open http://localhost:3000 in your browser.

## Usage Guide

### Step 1: Upload Your Content Library

1. Navigate to the **Library** tab
2. Drag and drop your existing images (up to 270+)
3. The system automatically extracts captions from images using Claude's vision API
4. Review extracted captions and correct any errors
5. Mark your best captions as favorites for priority training

### Step 2: Analyze Your Brand Voice

1. After uploading, click **"Analyze Library"**
2. The system will:
   - Extract caption patterns, phrases, and structures
   - Identify common themes in your imagery
   - Build a comprehensive brand voice profile
3. Review the analysis results in the profile dashboard

### Step 3: Generate Content

1. Navigate to the **Generate** tab
2. Select dates (individual days or full week)
3. Choose image mode:
   - **Stock Photos**: Free, uses Pexels/Unsplash
   - **AI Generated**: Paid, uses DALL-E 3
4. Click **Generate**
5. Wait for content creation (typically 2-5 minutes for a week)

### Step 4: Review & Edit

1. Browse generated carousels in the preview panel
2. For each slide:
   - **Edit Caption**: Make manual adjustments
   - **New Caption**: Regenerate with AI
   - **New Image**: Fetch a different image
3. Check the brand voice score (aim for 70%+)

### Step 5: Export

1. Click **Export** on any carousel
2. Downloads a ZIP containing:
   - All 6 images
   - Captions file (JSON/CSV/TXT)
   - Metadata file with theme and scores

## Architecture

```
break-free-content-system/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── library/        # Upload, analysis, management
│   │   │   ├── generate/       # Content generation
│   │   │   ├── export/         # ZIP downloads
│   │   │   └── settings/       # Configuration
│   │   ├── globals.css         # Styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main dashboard
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── library/            # Library-specific components
│   │   ├── content/            # Content generation components
│   │   └── settings/           # Settings components
│   ├── lib/
│   │   ├── claude-service.ts   # Claude API integration
│   │   ├── image-service.ts    # DALL-E/Pexels/Unsplash
│   │   ├── storage-service.ts  # Data persistence
│   │   └── utils.ts            # Utility functions
│   ├── store/
│   │   └── index.ts            # Zustand state management
│   └── types/
│       └── index.ts            # TypeScript definitions
├── data/                       # Local storage (auto-created)
│   ├── library/                # Uploaded images & index
│   ├── profile/                # Brand voice profile
│   ├── content/                # Generated carousels
│   └── exports/                # ZIP exports
├── .env.example                # Environment template
├── package.json
├── tailwind.config.ts
└── README.md
```

## API Services

### Claude API (claude-service.ts)

Handles all AI-powered text operations:

- **Caption Extraction**: Uses vision API to read text overlaid on images
- **Theme Generation**: Creates creative visual themes for carousels
- **Caption Generation**: Produces 6 captions per theme matching brand voice
- **Pattern Analysis**: Analyzes caption patterns for brand voice profile

### Image Service (image-service.ts)

Dual-mode image sourcing:

- **DALL-E 3**: Generates unique images based on theme and caption
- **Pexels/Unsplash**: Searches stock photo APIs with smart keyword expansion

### Storage Service (storage-service.ts)

Local file-based storage:

- Library images and metadata
- Brand voice profiles
- Generated carousel content
- User settings

## Brand Voice Profile

The system learns from your existing content:

| Metric | Description |
|--------|-------------|
| Caption Length | Average, min, max character counts |
| Common Phrases | Recurring words and expressions |
| Joke Structures | Patterns like "when you...", "how it feels..." |
| Tone Markers | Words defining brand tone (humorous, relatable, etc.) |
| Theme Preferences | Common visual themes identified in images |
| Aesthetic Style | Epic, cinematic, surreal, etc. |

## Cost Estimation

| Service | Cost | Usage |
|---------|------|-------|
| Claude Sonnet | ~$0.003/1K tokens | Caption extraction & generation |
| DALL-E 3 | $0.04-0.08/image | AI image generation (optional) |
| Pexels | Free | Stock photos (unlimited) |
| Unsplash | Free | Stock photos (50 req/hr) |

**Estimated costs per week (7 carousels, 42 images):**
- Stock photo mode: ~$0.50-1.00
- AI image mode: ~$2.00-4.00

## Troubleshooting

### Common Issues

**"ANTHROPIC_API_KEY is not configured"**
- Ensure `.env.local` exists with valid API key
- Restart the development server after adding keys

**Caption extraction shows low confidence**
- Images with unusual fonts or colors may need manual correction
- Use the edit feature to correct extracted captions

**Stock photos not matching theme**
- Try regenerating with different search terms
- Switch between Pexels/Unsplash sources in settings

**DALL-E rate limiting**
- The system includes delays between requests
- For bulk generation, consider using stock photos first

### Debug Mode

Enable verbose logging:

```env
DEBUG=true
```

## Extending the System

### Adding New Image Sources

1. Add API client in `src/lib/image-service.ts`
2. Implement the `GeneratedImage` interface
3. Add source option in settings

### Custom Caption Categories

Edit the `CaptionCategory` type in `src/types/index.ts`:

```typescript
export type CaptionCategory = 
  | 'post-run'
  | 'during-run'
  // Add new categories here
  | 'your-custom-category';
```

### Modifying Prompts

AI prompts are in `src/lib/claude-service.ts`. Key functions:
- `extractCaptionFromImage`: Caption extraction prompt
- `generateTheme`: Theme generation prompt
- `generateCaptions`: Caption generation with few-shot examples

## Example Outputs

### Sample Theme
```
Theme: Volcanic explorers
Description: Dramatic scenes of explorers navigating volcanic landscapes with flowing lava and epic mountain backdrops.
```

### Sample Captions
1. "how it feels walking inside wearing warm clothes after running outside" (post-run)
2. "me convincing myself that one more mile won't hurt" (during-run)
3. "realizing I have no idea how to get back down this trail" (humor)
4. "where I end up trying to find my garmin charger" (gear)
5. "when someone asks if I'm training for something" (motivation)
6. "my legs the day after a long run" (recovery)

### Brand Voice Score
- 80-100%: Excellent match to library style
- 60-79%: Good match with some variation
- Below 60%: Consider regenerating or adjusting strictness

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues or feature requests, please open a GitHub issue or contact the development team.

---

Built with ❤️ for the running community.
