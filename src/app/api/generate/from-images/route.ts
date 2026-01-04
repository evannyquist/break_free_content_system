/**
 * Image-First Generation API Route
 * Generate captions for existing images (reverse workflow)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCaptionForImage, generateMultipleCaptions } from '@/lib/claude-service';
import { downloadImageAsBase64 } from '@/lib/cosmos-service';
import {
  getBrandVoiceProfile,
  saveCarousel,
  initializeDataDirectory,
} from '@/lib/storage-service';
import type { CarouselContent, CarouselItem, GeneratedImage, GeneratedCaption } from '@/types';
import { generateId } from '@/lib/utils';

export const maxDuration = 180; // Allow 3 minutes for processing multiple images

/**
 * POST: Generate captions for a set of images
 * Body:
 * - imageUrls: string[] - URLs of images to caption
 * - sourceCluster?: string - Attribution (e.g., "cosmos.so/user/collection")
 * - theme?: string - Optional theme override
 * - saveAsCarousel?: boolean - Whether to save as a carousel
 * - captionCount?: number - Number of caption options per image (default: 1, max: 3)
 */
export async function POST(request: NextRequest) {
  try {
    await initializeDataDirectory();

    const body = await request.json();
    const {
      imageUrls,
      sourceCluster,
      theme,
      saveAsCarousel = false,
      captionCount = 1, // NEW: number of captions per image
    } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'imageUrls array is required' },
        { status: 400 }
      );
    }

    if (imageUrls.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 images per request' },
        { status: 400 }
      );
    }

    // Validate caption count (1-3)
    const numCaptions = Math.min(Math.max(1, captionCount), 3);

    // Get brand profile for voice consistency
    const profile = await getBrandVoiceProfile();

    // Process each image - result structure depends on captionCount
    interface CaptionResult {
      id: string;
      text: string;
      category: string;
      emotion: string;
      brandVoiceScore: number;
    }

    const results: Array<{
      imageUrl: string;
      caption?: CaptionResult; // Single caption (backward compatible)
      captionOptions?: CaptionResult[]; // Multiple captions when captionCount > 1
      error?: string;
    }> = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];

      try {
        // Download image as base64
        const base64 = await downloadImageAsBase64(imageUrl);

        // Determine media type from URL (check both extension and format query param)
        let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'; // Default to jpeg
        const urlLower = imageUrl.toLowerCase();
        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('format=jpeg')) {
          mediaType = 'image/jpeg';
        } else if (urlLower.includes('.png') || urlLower.includes('format=png')) {
          mediaType = 'image/png';
        } else if (urlLower.includes('.webp') || urlLower.includes('format=webp')) {
          mediaType = 'image/webp';
        } else if (urlLower.includes('.gif') || urlLower.includes('format=gif')) {
          mediaType = 'image/gif';
        }

        if (numCaptions > 1) {
          // Generate multiple caption options
          const captions = await generateMultipleCaptions(base64, profile, mediaType, numCaptions);

          results.push({
            imageUrl,
            captionOptions: captions.map(cap => ({
              id: cap.id,
              text: cap.text,
              category: cap.category,
              emotion: cap.theme,
              brandVoiceScore: cap.brandVoiceScore,
            })),
          });
        } else {
          // Generate single caption (backward compatible)
          const caption = await generateCaptionForImage(base64, profile, mediaType);

          results.push({
            imageUrl,
            caption: {
              id: caption.id,
              text: caption.text,
              category: caption.category,
              emotion: caption.theme,
              brandVoiceScore: caption.brandVoiceScore,
            },
          });
        }

        // Rate limiting delay between images
        if (i < imageUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to process image ${imageUrl}:`, error);
        const fallbackCaption = {
          id: generateId(),
          text: 'me after that run',
          category: 'humor',
          emotion: 'unknown',
          brandVoiceScore: 50,
        };

        results.push({
          imageUrl,
          caption: numCaptions === 1 ? fallbackCaption : undefined,
          captionOptions: numCaptions > 1 ? [fallbackCaption] : undefined,
          error: error instanceof Error ? error.message : 'Failed to process image',
        });
      }
    }

    // Optionally save as a carousel (uses first caption option if multiple)
    let carousel: CarouselContent | null = null;
    if (saveAsCarousel && results.length >= 1) {
      const items: CarouselItem[] = results.map((result, index) => {
        // Get caption - either single or first from options
        const cap = result.caption || (result.captionOptions && result.captionOptions[0]);
        if (!cap) {
          return {
            index,
            caption: {
              id: generateId(),
              text: 'me after that run',
              theme: theme || 'humor',
              brandVoiceScore: 50,
              category: 'humor' as CarouselItem['caption']['category'],
              regenerationCount: 0,
            },
            image: {
              id: generateId(),
              url: result.imageUrl,
              source: 'cosmos' as GeneratedImage['source'],
              attribution: sourceCluster ? `Source: ${sourceCluster}` : 'cosmos.so',
              regenerationCount: 0,
            },
          };
        }

        return {
          index,
          caption: {
            id: cap.id,
            text: cap.text,
            theme: theme || cap.emotion,
            brandVoiceScore: cap.brandVoiceScore,
            category: cap.category as CarouselItem['caption']['category'],
            regenerationCount: 0,
          },
          image: {
            id: generateId(),
            url: result.imageUrl,
            source: 'cosmos' as GeneratedImage['source'],
            attribution: sourceCluster ? `Source: ${sourceCluster}` : 'cosmos.so',
            regenerationCount: 0,
          },
        };
      });

      const avgBrandScore = items.reduce((sum, item) => sum + item.caption.brandVoiceScore, 0) / items.length;

      // Get theme from first result
      const firstCap = results[0]?.caption || (results[0]?.captionOptions && results[0]?.captionOptions[0]);

      carousel = {
        id: generateId(),
        date: new Date().toISOString().split('T')[0],
        theme: theme || firstCap?.emotion || 'curated',
        themeDescription: sourceCluster || 'Images from cosmos.so',
        imageMode: 'stock', // Using existing images
        items,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        brandVoiceScore: Math.round(avgBrandScore),
      };

      await saveCarousel(carousel);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      carousel: carousel ? {
        id: carousel.id,
        theme: carousel.theme,
        itemCount: carousel.items.length,
      } : null,
    });
  } catch (error) {
    console.error('Image-first generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Get status/info about image-first generation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate/from-images',
    description: 'Generate captions for existing images (image-first workflow)',
    method: 'POST',
    body: {
      imageUrls: 'string[] - URLs of images to caption (required, max 10)',
      sourceCluster: 'string - Attribution source (optional)',
      theme: 'string - Theme override (optional)',
      saveAsCarousel: 'boolean - Save results as carousel (optional, default false)',
      captionCount: 'number - Number of caption options per image (1-3, default 1)',
    },
    response: {
      singleCaption: 'When captionCount=1, each result has "caption" object',
      multipleCaption: 'When captionCount>1, each result has "captionOptions" array',
    },
    example: {
      imageUrls: [
        'https://cdn.cosmos.so/84b27660-68de-485b-8b2d-b94e9d37dcee',
      ],
      captionCount: 3,
      sourceCluster: 'cosmos.so/geok103/late-romantic',
      saveAsCarousel: false,
    },
    exampleResponse: {
      success: true,
      count: 1,
      results: [{
        imageUrl: 'https://cdn.cosmos.so/...',
        captionOptions: [
          { id: '...', text: 'caption focusing on situation', category: 'humor', emotion: 'exhaustion', brandVoiceScore: 85 },
          { id: '...', text: 'caption focusing on emotion', category: 'post-run', emotion: 'exhaustion', brandVoiceScore: 78 },
          { id: '...', text: 'caption focusing on action', category: 'during-run', emotion: 'exhaustion', brandVoiceScore: 82 },
        ],
      }],
    },
  });
}
