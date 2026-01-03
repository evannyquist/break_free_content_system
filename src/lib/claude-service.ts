/**
 * Claude API Service
 * Handles all interactions with the Anthropic Claude API for:
 * - Caption extraction from images
 * - Theme generation
 * - Caption generation
 * - Brand voice analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LibraryImage,
  BrandVoiceProfile,
  GeneratedCaption,
  CaptionCategory,
  CaptionPattern,
  ThemePattern,
} from '@/types';
import { generateId } from '@/lib/utils';

// Initialize the Anthropic client
const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
};

/**
 * Extract caption from an image using Claude's vision capabilities
 */
export async function extractCaptionFromImage(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{ caption: string; confidence: number }> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `This is a social media post image for a running brand called "Break Free". The image has a humorous caption overlaid on it as text.

Your task: Extract ONLY the caption text that appears on this image.

Rules:
1. Return ONLY the exact caption text, nothing else
2. If there are multiple text elements, return the main caption (usually the humorous running-related text)
3. Ignore any watermarks, brand names, or decorative text
4. If you cannot find any caption text, return "NO_CAPTION_FOUND"
5. After the caption, add a pipe character (|) followed by a confidence score from 0.0 to 1.0

Example response format:
"how it feels walking inside wearing warm clothes after running outside|0.95"

Now extract the caption from this image:`,
          },
        ],
      },
    ],
  });

  // Parse the response
  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : '';

  // Split by pipe to get caption and confidence
  const parts = responseText.split('|');
  const caption = parts[0].trim();
  const confidence = parts[1] ? parseFloat(parts[1].trim()) : 0.7;

  return {
    caption: caption === 'NO_CAPTION_FOUND' ? '' : caption,
    confidence: isNaN(confidence) ? 0.7 : confidence,
  };
}

/**
 * Analyze image to identify theme and aesthetic
 */
export async function analyzeImageTheme(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<{ theme: string; aesthetics: string[] }> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Analyze this image for a running brand content library.

Identify:
1. THEME: The main subject/theme (e.g., "lions", "mountains", "motorcycles", "desert landscape", "aviators")
2. AESTHETICS: Visual style descriptors (e.g., "epic", "cinematic", "surreal", "dramatic", "fantastical")

Response format (exactly):
THEME: [single theme word or short phrase]
AESTHETICS: [comma-separated list of 2-4 descriptors]

Example:
THEME: volcanic landscape
AESTHETICS: epic, surreal, cinematic, dramatic`,
          },
        ],
      },
    ],
  });

  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : '';

  // Parse the response
  const themeMatch = responseText.match(/THEME:\s*(.+)/i);
  const aestheticsMatch = responseText.match(/AESTHETICS:\s*(.+)/i);

  return {
    theme: themeMatch ? themeMatch[1].trim() : 'unknown',
    aesthetics: aestheticsMatch
      ? aestheticsMatch[1].split(',').map((a) => a.trim().toLowerCase())
      : ['epic'],
  };
}

/**
 * Analyze a collection of captions to build a brand voice profile
 */
export async function analyzeCaptionPatterns(
  captions: string[]
): Promise<Partial<BrandVoiceProfile>> {
  const client = getClient();

  const captionsSample = captions.slice(0, 50).join('\n- ');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are analyzing captions from "Break Free", a running brand that creates humorous, relatable content for runners.

Here are ${Math.min(50, captions.length)} example captions:
- ${captionsSample}

Analyze these captions and provide a detailed brand voice profile. Return your analysis in the following JSON format:

{
  "averageCaptionLength": <number - average character count>,
  "captionLengthRange": { "min": <number>, "max": <number> },
  "commonPhrases": [<list of 10 recurring phrases or words>],
  "jokeStructures": [<list of 5 common joke patterns/structures used>],
  "toneMarkers": [<list of 8 words that define the tone>],
  "captionCategories": {
    "post-run": <count>,
    "during-run": <count>,
    "gear": <count>,
    "weather": <count>,
    "race-day": <count>,
    "recovery": <count>,
    "training": <count>,
    "motivation": <count>,
    "humor": <count>,
    "other": <count>
  }
}

Return ONLY valid JSON, no additional text.`,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : '{}';

  try {
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Failed to parse caption analysis:', error);
    return {};
  }
}

/**
 * Generate a theme for carousel content
 */
export async function generateTheme(
  brandProfile: BrandVoiceProfile | null,
  excludeThemes: string[] = [],
  preferredCategories: string[] = []
): Promise<{ theme: string; description: string }> {
  const client = getClient();

  const profileContext = brandProfile
    ? `
The brand has previously used these successful themes: ${brandProfile.commonThemes
        .slice(0, 10)
        .map((t) => t.theme)
        .join(', ')}.
Their aesthetic preferences are: ${brandProfile.aestheticPreferences.join(', ')}.
`
    : '';

  const excludeContext = excludeThemes.length > 0
    ? `\nDo NOT use these themes (already used recently): ${excludeThemes.join(', ')}`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Generate a creative visual theme for "Break Free", a running brand that creates humorous Instagram carousels with epic/surreal imagery and relatable running humor.

${profileContext}
${excludeContext}

The theme should be:
- A visual concept (animals, landscapes, professions, vehicles, scenarios, etc.)
- Epic, cinematic, or surreal in nature
- Suitable for dramatic, scroll-stopping imagery
- Flexible enough for 6 different images with running captions

Return in this exact format:
THEME: [1-3 word theme name]
DESCRIPTION: [1 sentence describing the visual direction]

Example:
THEME: Volcanic explorers
DESCRIPTION: Dramatic scenes of explorers navigating volcanic landscapes with flowing lava and epic mountain backdrops.`,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : '';

  const themeMatch = responseText.match(/THEME:\s*(.+)/i);
  const descMatch = responseText.match(/DESCRIPTION:\s*(.+)/i);

  return {
    theme: themeMatch ? themeMatch[1].trim() : 'Epic landscapes',
    description: descMatch 
      ? descMatch[1].trim() 
      : 'Dramatic natural scenery with surreal elements.',
  };
}

/**
 * Generate captions for a theme
 */
export async function generateCaptions(
  theme: string,
  themeDescription: string,
  count: number = 6,
  brandProfile: BrandVoiceProfile | null
): Promise<GeneratedCaption[]> {
  const client = getClient();

  // Build few-shot examples from brand profile
  let examplesContext = '';
  if (brandProfile && brandProfile.exampleCaptions.length > 0) {
    const examples = brandProfile.favoritesCaptions.length > 3
      ? brandProfile.favoritesCaptions.slice(0, 6)
      : brandProfile.exampleCaptions.slice(0, 6);
    examplesContext = `
Here are example captions that match the brand voice:
${examples.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

The brand voice characteristics:
- Average length: ${brandProfile.averageCaptionLength} characters
- Tone: ${brandProfile.toneMarkers.join(', ')}
- Common patterns: ${brandProfile.jokeStructures.slice(0, 3).join('; ')}
`;
  } else {
    examplesContext = `
Example captions for reference:
1. "how it feels walking inside wearing warm clothes after running outside"
2. "realizing I have no idea how to get back down this trail"
3. "where I end up trying to find my garmin charger"
4. "me convincing myself that one more mile won't hurt"
5. "when someone asks if I'm training for something"
`;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} captions for "Break Free", a running brand Instagram carousel.

Theme: ${theme}
Visual direction: ${themeDescription}

${examplesContext}

Caption requirements:
- Short and punchy (similar to examples)
- Running-specific situations and humor
- Relatable to everyday runners
- Self-deprecating, absurdist humor
- Each caption should work with a ${theme}-themed epic image
- Cover different running situations (post-run, during-run, gear, training, etc.)

Return EXACTLY ${count} captions in this format:
1. [caption text]|[category]
2. [caption text]|[category]
...

Categories: post-run, during-run, gear, weather, race-day, recovery, training, motivation, humor

Example format:
1. how it feels walking inside after running in -10 degrees|post-run
2. me trying to pace myself on the first mile|during-run`,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : '';

  // Parse the captions
  const captions: GeneratedCaption[] = [];
  const lines = responseText.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)\|(.+)$/);
    if (match) {
      const captionText = match[1].trim();
      const category = match[2].trim().toLowerCase() as CaptionCategory;

      // Calculate brand voice score
      const brandVoiceScore = brandProfile
        ? calculateBrandScore(captionText, brandProfile)
        : 70;

      captions.push({
        id: generateId(),
        text: captionText,
        theme,
        brandVoiceScore,
        category: isValidCategory(category) ? category : 'humor',
        regenerationCount: 0,
      });
    }
  }

  // Ensure we have the right count
  while (captions.length < count) {
    captions.push({
      id: generateId(),
      text: `me after running with ${theme}`,
      theme,
      brandVoiceScore: 60,
      category: 'humor',
      regenerationCount: 0,
    });
  }

  return captions.slice(0, count);
}

/**
 * Regenerate a single caption
 */
export async function regenerateCaption(
  theme: string,
  existingCaptions: string[],
  brandProfile: BrandVoiceProfile | null,
  category?: CaptionCategory
): Promise<GeneratedCaption> {
  const client = getClient();

  const excludeContext = existingCaptions.length > 0
    ? `\nDo NOT repeat these existing captions:\n${existingCaptions.map((c) => `- "${c}"`).join('\n')}`
    : '';

  const categoryContext = category
    ? `\nThe caption should fit the "${category}" category.`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Generate ONE new caption for "Break Free" running brand.

Theme: ${theme}
${excludeContext}
${categoryContext}

Requirements:
- Short, punchy running humor
- Relatable, self-deprecating tone
- Works with epic ${theme} imagery

Return in format: [caption]|[category]
Categories: post-run, during-run, gear, weather, race-day, recovery, training, motivation, humor`,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' 
    ? response.content[0].text.trim() 
    : '';

  const match = responseText.match(/(.+)\|(.+)/);
  const captionText = match ? match[1].trim() : responseText;
  const parsedCategory = match 
    ? (match[2].trim().toLowerCase() as CaptionCategory) 
    : 'humor';

  const brandVoiceScore = brandProfile
    ? calculateBrandScore(captionText, brandProfile)
    : 70;

  return {
    id: generateId(),
    text: captionText,
    theme,
    brandVoiceScore,
    category: isValidCategory(parsedCategory) ? parsedCategory : (category || 'humor'),
    regenerationCount: 0,
  };
}

// Helper functions

function calculateBrandScore(caption: string, profile: BrandVoiceProfile): number {
  let score = 50;
  const lowerCaption = caption.toLowerCase();

  // Length similarity (±20 points)
  const lengthDiff = Math.abs(caption.length - profile.averageCaptionLength);
  score += Math.max(0, 20 - lengthDiff / 3);

  // Common phrases (up to 15 points)
  const phraseMatches = profile.commonPhrases.filter((phrase) =>
    lowerCaption.includes(phrase.toLowerCase())
  ).length;
  score += Math.min(15, phraseMatches * 5);

  // Tone markers (up to 15 points)
  const toneMatches = profile.toneMarkers.filter((marker) =>
    lowerCaption.includes(marker.toLowerCase())
  ).length;
  score += Math.min(15, toneMatches * 3);

  return Math.min(100, Math.max(0, Math.round(score)));
}

function isValidCategory(category: string): category is CaptionCategory {
  const validCategories: CaptionCategory[] = [
    'post-run',
    'during-run',
    'gear',
    'weather',
    'race-day',
    'recovery',
    'training',
    'motivation',
    'humor',
    'other',
  ];
  return validCategories.includes(category as CaptionCategory);
}
