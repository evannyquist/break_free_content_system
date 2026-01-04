/**
 * Image Service
 * Handles image sourcing from:
 * - Flux Pro 1.1 (AI generation via Replicate)
 * - Pexels API (stock photos)
 * - Unsplash API (stock photos)
 */

import Replicate from 'replicate';
import type { GeneratedImage, BrandVoiceProfile } from '@/types';
import { generateId } from '@/lib/utils';

// Initialize Replicate client
const getReplicateClient = () => {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }
  return new Replicate({ auth: apiToken });
};

// =====================================
// Flux Pro 1.1 Image Generation (Replicate)
// =====================================

/**
 * Generate an image using Flux Pro 1.1 via Replicate
 * Produces cinematic, film-like imagery with authentic vintage movie aesthetics
 * @param sceneDescription - Detailed scene description from Claude
 */
export async function generateFluxImage(
  sceneDescription: string
): Promise<GeneratedImage> {
  const client = getReplicateClient();

  // Build prompt with cinematic film styling
  const prompt = `${sceneDescription}

Shot on 35mm film, anamorphic lens, cinematic lighting. The scene has the quality of a film still from a classic movie - natural grain, authentic colors, dramatic composition. Professional cinematography, Kodak film stock aesthetic.`;

  try {
    const output = await client.run(
      'black-forest-labs/flux-1.1-pro',
      {
        input: {
          prompt,
          aspect_ratio: '1:1',
          output_format: 'webp',
          output_quality: 90,
          safety_tolerance: 2,
          prompt_upsampling: true,
        },
      }
    );

    // Flux returns a URL string directly
    const imageUrl = typeof output === 'string' ? output : String(output);

    if (!imageUrl || !imageUrl.startsWith('http')) {
      throw new Error('Invalid image URL returned from Flux');
    }

    return {
      id: generateId(),
      url: imageUrl,
      source: 'flux',
      prompt,
      regenerationCount: 0,
    };
  } catch (error) {
    console.error('Flux generation error:', error);
    throw error;
  }
}

// =====================================
// Pexels API
// =====================================

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
  };
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

/**
 * Search Pexels for images
 */
export async function searchPexels(
  theme: string,
  count: number = 6,
  brandProfile: BrandVoiceProfile | null
): Promise<GeneratedImage[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error('PEXELS_API_KEY is not configured');
  }

  // Build search query
  const searchQuery = buildStockSearchQuery(theme, brandProfile);
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=${count * 2}&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data: PexelsResponse = await response.json();

    // Filter for quality and transform
    return data.photos
      .filter((photo) => photo.width >= 1024 && photo.height >= 768)
      .slice(0, count)
      .map((photo) => ({
        id: generateId(),
        url: photo.src.large2x || photo.src.large,
        source: 'pexels' as const,
        searchQuery,
        attribution: `Photo by ${photo.photographer} on Pexels`,
        regenerationCount: 0,
      }));
  } catch (error) {
    console.error('Pexels search error:', error);
    throw error;
  }
}

// =====================================
// Unsplash API
// =====================================

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: {
    raw: string;
    full: string;
    regular: string;
  };
  user: {
    name: string;
    username: string;
  };
  links: {
    html: string;
  };
}

interface UnsplashResponse {
  results: UnsplashPhoto[];
  total: number;
}

/**
 * Search Unsplash for images
 */
export async function searchUnsplash(
  theme: string,
  count: number = 6,
  brandProfile: BrandVoiceProfile | null
): Promise<GeneratedImage[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY is not configured');
  }

  const searchQuery = buildStockSearchQuery(theme, brandProfile);

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${count * 2}&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data: UnsplashResponse = await response.json();

    return data.results
      .filter((photo) => photo.width >= 1024)
      .slice(0, count)
      .map((photo) => ({
        id: generateId(),
        url: photo.urls.regular,
        source: 'unsplash' as const,
        searchQuery,
        attribution: `Photo by ${photo.user.name} on Unsplash`,
        regenerationCount: 0,
      }));
  } catch (error) {
    console.error('Unsplash search error:', error);
    throw error;
  }
}

// =====================================
// Combined Stock Search
// =====================================

/**
 * Search both Pexels and Unsplash, return best results
 */
export async function searchStockPhotos(
  theme: string,
  count: number = 6,
  brandProfile: BrandVoiceProfile | null,
  source: 'pexels' | 'unsplash' | 'both' = 'both'
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  if (source === 'pexels' || source === 'both') {
    try {
      const pexelsResults = await searchPexels(
        theme,
        source === 'both' ? Math.ceil(count / 2) : count,
        brandProfile
      );
      results.push(...pexelsResults);
    } catch (error) {
      console.error('Pexels search failed:', error);
    }
  }

  if (source === 'unsplash' || source === 'both') {
    try {
      const unsplashResults = await searchUnsplash(
        theme,
        source === 'both' ? Math.ceil(count / 2) : count,
        brandProfile
      );
      results.push(...unsplashResults);
    } catch (error) {
      console.error('Unsplash search failed:', error);
    }
  }

  // Shuffle and return requested count
  const shuffled = results.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// =====================================
// Helper Functions
// =====================================

/**
 * Build an optimized search query for stock photos
 */
function buildStockSearchQuery(
  theme: string,
  brandProfile: BrandVoiceProfile | null
): string {
  // Start with the theme
  let query = theme.toLowerCase();

  // Add aesthetic modifiers based on brand profile
  const aesthetics = brandProfile?.aestheticPreferences || ['epic', 'dramatic'];
  
  // Map aesthetics to search-friendly terms
  const aestheticMappings: Record<string, string> = {
    epic: 'dramatic landscape',
    cinematic: 'cinematic',
    surreal: 'surreal fantasy',
    dramatic: 'dramatic lighting',
    fantastical: 'fantasy',
    moody: 'moody atmosphere',
  };

  // Add one or two aesthetic modifiers
  for (const aesthetic of aesthetics.slice(0, 2)) {
    const mapping = aestheticMappings[aesthetic.toLowerCase()];
    if (mapping && !query.includes(mapping.split(' ')[0])) {
      query = `${query} ${mapping}`;
      break; // Only add one modifier to keep query focused
    }
  }

  return query;
}

/**
 * Download and convert image to base64
 */
export async function downloadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

/**
 * Get a fallback image if all sources fail
 */
export function getFallbackImage(theme: string): GeneratedImage {
  // Return a placeholder that can be replaced
  return {
    id: generateId(),
    url: `https://placehold.co/1024x1024/1a1a2e/ec751b?text=${encodeURIComponent(theme)}`,
    source: 'pexels', // Placeholder
    searchQuery: theme,
    attribution: 'Placeholder - please regenerate',
    regenerationCount: 0,
  };
}
