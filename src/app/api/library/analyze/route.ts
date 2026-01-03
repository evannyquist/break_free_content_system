/**
 * Library Analysis API Route
 * Analyzes uploaded images to build a brand voice profile
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeCaptionPatterns,
  analyzeImageTheme,
} from '@/lib/claude-service';
import {
  getLibraryImages,
  getLibraryImageBase64,
  saveBrandVoiceProfile,
  updateLibraryImage,
} from '@/lib/storage-service';
import type { BrandVoiceProfile, ThemePattern, CaptionPattern } from '@/types';
import { generateId } from '@/lib/utils';

export const maxDuration = 120; // Allow 2 minutes for full analysis

export async function POST(request: NextRequest) {
  try {
    const images = await getLibraryImages();

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images in library to analyze' },
        { status: 400 }
      );
    }

    // Step 1: Gather all captions
    const captions = images
      .map((img) => img.extractedCaption)
      .filter((caption) => caption && caption.length > 0);

    if (captions.length === 0) {
      return NextResponse.json(
        { error: 'No captions found in library images' },
        { status: 400 }
      );
    }

    // Step 2: Analyze caption patterns
    const captionAnalysis = await analyzeCaptionPatterns(captions);

    // Step 3: Analyze image themes (sample a subset for efficiency)
    const sampleSize = Math.min(20, images.length);
    const sampledImages = images
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    const themeMap = new Map<string, { count: number; aesthetics: Set<string> }>();
    const allAesthetics = new Set<string>();

    // Process themes in batches
    const batchSize = 3;
    for (let i = 0; i < sampledImages.length; i += batchSize) {
      const batch = sampledImages.slice(i, i + batchSize);

      const batchPromises = batch.map(async (image) => {
        try {
          const base64 = await getLibraryImageBase64(image.id);
          if (!base64) return null;

          const { theme, aesthetics } = await analyzeImageTheme(base64);

          // Update the image record
          await updateLibraryImage(image.id, {
            analyzedTheme: theme,
            analyzedAesthetic: aesthetics,
          });

          return { theme, aesthetics };
        } catch (error) {
          console.error(`Failed to analyze image ${image.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result) {
          const existing = themeMap.get(result.theme) || {
            count: 0,
            aesthetics: new Set<string>(),
          };
          existing.count++;
          result.aesthetics.forEach((a) => existing.aesthetics.add(a));
          result.aesthetics.forEach((a) => allAesthetics.add(a));
          themeMap.set(result.theme, existing);
        }
      }

      // Delay between batches
      if (i + batchSize < sampledImages.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Step 4: Build theme patterns
    const themePatterns: ThemePattern[] = Array.from(themeMap.entries())
      .map(([theme, data]) => ({
        theme,
        frequency: data.count,
        examples: [],
        aesthetic: Array.from(data.aesthetics),
      }))
      .sort((a, b) => b.frequency - a.frequency);

    // Step 5: Calculate additional metrics
    const captionLengths = captions.map((c) => c.length);
    const averageLength =
      captionLengths.reduce((a, b) => a + b, 0) / captionLengths.length;

    // Step 6: Select example captions (mix of lengths and categories)
    const sortedByCaptionLength = [...captions].sort(
      (a, b) => Math.abs(a.length - averageLength) - Math.abs(b.length - averageLength)
    );
    const exampleCaptions = sortedByCaptionLength.slice(0, 20);

    // Step 7: Get favorites
    const favoritesCaptions = images
      .filter((img) => img.isFavorite)
      .map((img) => img.extractedCaption)
      .filter((c) => c && c.length > 0);

    // Step 8: Build the brand voice profile
    const profile: BrandVoiceProfile = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalCaptionsAnalyzed: captions.length,
      totalImagesAnalyzed: sampledImages.length,

      // Caption analysis
      averageCaptionLength: Math.round(averageLength),
      captionLengthRange: {
        min: Math.min(...captionLengths),
        max: Math.max(...captionLengths),
      },
      commonPhrases: captionAnalysis.commonPhrases || [],
      jokeStructures: captionAnalysis.jokeStructures || [],
      toneMarkers: captionAnalysis.toneMarkers || [],
      captionPatterns: [],
      captionCategories: captionAnalysis.captionCategories || {
        'post-run': 0,
        'during-run': 0,
        gear: 0,
        weather: 0,
        'race-day': 0,
        recovery: 0,
        training: 0,
        motivation: 0,
        humor: 0,
        other: 0,
      },

      // Theme analysis
      commonThemes: themePatterns,
      aestheticPreferences: Array.from(allAesthetics),
      colorPalettes: [],
      compositionStyles: [],

      // Examples for few-shot learning
      exampleCaptions,
      favoritesCaptions,
    };

    // Step 9: Save the profile
    await saveBrandVoiceProfile(profile);

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        // Return summary stats
        summary: {
          captionsAnalyzed: profile.totalCaptionsAnalyzed,
          imagesAnalyzed: profile.totalImagesAnalyzed,
          averageCaptionLength: profile.averageCaptionLength,
          topThemes: profile.commonThemes.slice(0, 5).map((t) => t.theme),
          aesthetics: profile.aestheticPreferences.slice(0, 5),
          toneMarkers: profile.toneMarkers.slice(0, 5),
        },
      },
    });
  } catch (error) {
    console.error('Library analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve current brand voice profile
 */
export async function GET() {
  try {
    const { getBrandVoiceProfile } = await import('@/lib/storage-service');
    const profile = await getBrandVoiceProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'No brand voice profile found. Please analyze your library first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get profile' },
      { status: 500 }
    );
  }
}
