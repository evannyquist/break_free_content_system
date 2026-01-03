/**
 * Library Upload API Route
 * Handles uploading images and extracting captions
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractCaptionFromImage, analyzeImageTheme } from '@/lib/claude-service';
import { saveLibraryImages, initializeDataDirectory, findDuplicate, computeContentHash } from '@/lib/storage-service';
import type { LibraryImage } from '@/types';
import { generateId } from '@/lib/utils';

export const maxDuration = 60; // Allow longer execution for batch processing

export async function POST(request: NextRequest) {
  try {
    await initializeDataDirectory();

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    const results: LibraryImage[] = [];
    const errors: Array<{ filename: string; error: string }> = [];
    const duplicates: Array<{ filename: string; existingFilename: string }> = [];

    // Process images in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const batchPromises = batch.map(async (file) => {
        try {
          // Convert file to buffer and base64
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');

          // Compute content hash for duplicate detection
          const contentHash = computeContentHash(buffer);

          // Check for duplicates by filename or content hash
          const existingImage = await findDuplicate(file.name, contentHash);
          if (existingImage) {
            duplicates.push({
              filename: file.name,
              existingFilename: existingImage.filename,
            });
            return null; // Skip duplicate
          }

          // Determine media type
          const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

          // Extract caption using Claude's vision API
          const { caption, confidence } = await extractCaptionFromImage(
            base64,
            mediaType
          );

          // Create library image entry
          const libraryImage: LibraryImage = {
            id: generateId(),
            filename: file.name,
            filepath: '', // Will be set when saved
            contentHash, // Store hash for future duplicate detection
            extractedCaption: caption,
            captionConfidence: confidence,
            manuallyVerified: false,
            isFavorite: false,
            uploadedAt: new Date().toISOString(),
            base64, // Temporary, will be removed after saving
          };

          return libraryImage;
        } catch (error) {
          errors.push({
            filename: file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is LibraryImage => r !== null));

      // Small delay between batches to avoid rate limits
      if (i + batchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Save all successfully processed images
    if (results.length > 0) {
      await saveLibraryImages(results);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      duplicatesSkipped: duplicates.length,
      images: results.map((img) => ({
        id: img.id,
        filename: img.filename,
        extractedCaption: img.extractedCaption,
        captionConfidence: img.captionConfidence,
      })),
      errors,
      duplicates,
    });
  } catch (error) {
    console.error('Library upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
