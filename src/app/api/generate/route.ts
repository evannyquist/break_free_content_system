/**
 * Content Generation API Route
 * Generates themes, captions, and images for carousels
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTheme, generateCaptions, regenerateCaption, generateImageScene } from '@/lib/claude-service';
import {
  generateFluxImage,
  searchStockPhotos,
  getFallbackImage,
} from '@/lib/image-service';
import {
  getBrandVoiceProfile,
  getSettings,
  saveCarousel,
  getCarousels,
  initializeDataDirectory,
} from '@/lib/storage-service';
import type { CarouselContent, CarouselItem, GeneratedImage } from '@/types';
import { generateId, formatDateForFile } from '@/lib/utils';

export const maxDuration = 120; // Allow 2 minutes for generation

/**
 * POST: Generate a new carousel or week of content
 */
export async function POST(request: NextRequest) {
  try {
    await initializeDataDirectory();

    const body = await request.json();
    const {
      dates, // Array of date strings to generate content for
      imageMode, // 'ai' or 'stock'
      regenerateItem, // Optional: { carouselId, itemIndex, type: 'caption' | 'image' }
    } = body;

    // Get brand profile and settings
    const profile = await getBrandVoiceProfile();
    const settings = await getSettings();
    const mode = imageMode || settings.imageMode;

    // Handle single item regeneration
    if (regenerateItem) {
      return handleRegeneration(regenerateItem, profile);
    }

    // Generate content for each date
    const carousels: CarouselContent[] = [];
    const existingCarousels = await getCarousels();
    const usedThemes = existingCarousels.map((c) => c.theme);

    for (const date of dates) {
      try {
        // Step 1: Generate theme
        const { theme, description } = await generateTheme(
          profile,
          usedThemes,
          settings.themeCategories
        );
        usedThemes.push(theme);

        // Step 2: Generate captions
        const captions = await generateCaptions(theme, description, 6, profile);

        // Step 3: Get images
        let images: GeneratedImage[] = [];
        if (mode === 'ai') {
          // Generate with Flux Pro 1.1 using emotion-aware scene descriptions
          for (const caption of captions) {
            try {
              // Step 3a: Generate detailed scene description from Claude
              const sceneDescription = await generateImageScene(
                caption.text,
                theme,
                description,
                profile
              );

              // Small delay before Flux call
              await new Promise((resolve) => setTimeout(resolve, 300));

              // Step 3b: Generate image with Flux Pro 1.1 using the scene description
              const image = await generateFluxImage(sceneDescription);
              images.push(image);
            } catch (error) {
              console.error('Image generation failed:', error);
              images.push(getFallbackImage(theme));
            }
            // Delay between generations
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } else {
          // Search stock photos
          images = await searchStockPhotos(
            theme,
            6,
            profile,
            settings.stockSource
          );

          // Fill in with fallbacks if needed
          while (images.length < 6) {
            images.push(getFallbackImage(theme));
          }
        }

        // Step 4: Combine into carousel items
        const items: CarouselItem[] = captions.map((caption, index) => ({
          index,
          caption,
          image: images[index] || getFallbackImage(theme),
        }));

        // Step 5: Calculate overall brand voice score
        const avgBrandScore =
          items.reduce((sum, item) => sum + item.caption.brandVoiceScore, 0) /
          items.length;

        // Step 6: Create carousel
        const carousel: CarouselContent = {
          id: generateId(),
          date,
          theme,
          themeDescription: description,
          imageMode: mode,
          items,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          brandVoiceScore: Math.round(avgBrandScore),
        };

        // Save carousel
        await saveCarousel(carousel);
        carousels.push(carousel);

        // Delay between carousels
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to generate carousel for ${date}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      generated: carousels.length,
      carousels,
    });
  } catch (error) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve generated carousels
 */
export async function GET(request: NextRequest) {
  try {
    await initializeDataDirectory();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let carousels = await getCarousels();

    // Filter by date range if provided
    if (startDate && endDate) {
      carousels = carousels.filter((c) => {
        const date = new Date(c.date);
        return date >= new Date(startDate) && date <= new Date(endDate);
      });
    }

    // Sort by date
    carousels.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      success: true,
      count: carousels.length,
      carousels,
    });
  } catch (error) {
    console.error('Get carousels error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get carousels' },
      { status: 500 }
    );
  }
}

/**
 * Handle regeneration of a single caption or image
 */
async function handleRegeneration(
  regenerateItem: { carouselId: string; itemIndex: number; type: 'caption' | 'image' },
  profile: import('@/types').BrandVoiceProfile | null
) {
  const { carouselId, itemIndex, type } = regenerateItem;

  const carousels = await getCarousels();
  const carousel = carousels.find((c) => c.id === carouselId);

  if (!carousel) {
    return NextResponse.json(
      { error: 'Carousel not found' },
      { status: 404 }
    );
  }

  const item = carousel.items[itemIndex];
  if (!item) {
    return NextResponse.json(
      { error: 'Item not found' },
      { status: 404 }
    );
  }

  if (type === 'caption') {
    // Get existing captions to avoid duplicates
    const existingCaptions = carousel.items.map((i) => i.caption.text);

    // Generate new caption
    const newCaption = await regenerateCaption(
      carousel.theme,
      existingCaptions,
      profile,
      item.caption.category
    );

    newCaption.regenerationCount = item.caption.regenerationCount + 1;

    // Update the item
    carousel.items[itemIndex].caption = newCaption;
  } else {
    // Regenerate image
    const settings = await getSettings();

    let newImage: GeneratedImage;
    if (carousel.imageMode === 'ai') {
      // Generate emotion-aware scene description first
      const sceneDescription = await generateImageScene(
        item.caption.text,
        carousel.theme,
        carousel.themeDescription,
        profile
      );

      // Then generate image with Flux Pro 1.1
      newImage = await generateFluxImage(sceneDescription);
    } else {
      const images = await searchStockPhotos(
        carousel.theme,
        3,
        profile,
        settings.stockSource
      );
      newImage = images[0] || getFallbackImage(carousel.theme);
    }

    newImage.regenerationCount = item.image.regenerationCount + 1;
    carousel.items[itemIndex].image = newImage;
  }

  // Update carousel
  carousel.updatedAt = new Date().toISOString();

  // Recalculate brand voice score
  carousel.brandVoiceScore = Math.round(
    carousel.items.reduce((sum, i) => sum + i.caption.brandVoiceScore, 0) /
      carousel.items.length
  );

  await saveCarousel(carousel);

  return NextResponse.json({
    success: true,
    carousel,
    regeneratedItem: carousel.items[itemIndex],
  });
}
