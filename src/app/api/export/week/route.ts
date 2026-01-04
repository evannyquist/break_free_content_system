/**
 * Week Export API Route
 * Exports a full week of content with overlays, 4:5 cropping (Instagram portrait), and category-based filenames
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import {
  processImageFromUrlForExport,
  type OverlayOptions,
} from '@/lib/overlay-service';
import {
  createExportDirectory,
  getExportsPath,
} from '@/lib/storage-service';
import { slugify } from '@/lib/utils';
import type { WeekPlan, DayContent, SelectedImage } from '@/types';

export const maxDuration = 300; // 5 minutes for full week export

interface ExportedImage {
  day: string;
  index: number;
  filename: string;
  caption: string;
  category: string;
  x: number;
  y: number;
  fontSize: number;
  textColor: string;
}

/**
 * POST: Export a week plan as a ZIP file with processed images
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekPlan } = body as { weekPlan: WeekPlan };

    if (!weekPlan || !weekPlan.days) {
      return NextResponse.json(
        { error: 'Week plan is required' },
        { status: 400 }
      );
    }

    // Check that at least one day has content
    const daysWithContent = weekPlan.days.filter(
      (d) => d.status === 'complete' || d.status === 'captions-selected'
    );

    if (daysWithContent.length === 0) {
      return NextResponse.json(
        { error: 'No completed days to export' },
        { status: 400 }
      );
    }

    // Create export directory
    const exportName = `break-free-week-${weekPlan.weekStartDate}`;
    const exportPath = await createExportDirectory(exportName);

    const exportedImages: ExportedImage[] = [];
    let totalProcessed = 0;
    let totalFailed = 0;

    // Process each day
    for (const day of weekPlan.days) {
      if (day.status !== 'complete' && day.status !== 'captions-selected') {
        continue; // Skip incomplete days
      }

      if (day.images.length === 0) {
        continue;
      }

      const daySlug = day.dayOfWeek.toLowerCase();

      // Process each image in the day
      for (let i = 0; i < day.images.length; i++) {
        const image = day.images[i];

        if (!image.selectedCaption) {
          continue; // Skip images without captions
        }

        try {
          // Build filename: {day}-{index}-{category-slug}.jpg
          const categorySlug = slugify(image.selectedCaption.category);
          const filename = `${daySlug}-${String(i + 1).padStart(2, '0')}-${categorySlug}.jpg`;
          const imagePath = path.join(exportPath, filename);

          // Process image with overlay and 4:5 crop (Instagram portrait)
          const overlayOptions: Partial<OverlayOptions> = {
            x: image.overlaySettings.x ?? 50,
            y: image.overlaySettings.y ?? 80,
            fontSize: image.overlaySettings.fontSize ?? 48,
            width: image.overlaySettings.width ?? 80,
            textAlign: image.overlaySettings.textAlign ?? 'center',
            textColor: image.overlaySettings.textColor,
            accentColor: image.overlaySettings.accentColor,
            // Image transform settings
            imageScale: image.overlaySettings.imageScale ?? 1,
            imageOffsetX: image.overlaySettings.imageOffsetX ?? 0,
            imageOffsetY: image.overlaySettings.imageOffsetY ?? 0,
          };

          const processedBuffer = await processImageFromUrlForExport(
            image.highResUrl,
            image.selectedCaption.text,
            overlayOptions
          );

          // Save to file
          await fs.writeFile(imagePath, processedBuffer);

          exportedImages.push({
            day: daySlug,
            index: i + 1,
            filename,
            caption: image.selectedCaption.text,
            category: image.selectedCaption.category,
            x: image.overlaySettings.x ?? 50,
            y: image.overlaySettings.y ?? 80,
            fontSize: image.overlaySettings.fontSize ?? 48,
            textColor: image.overlaySettings.textColor,
          });

          totalProcessed++;
        } catch (error) {
          console.error(`Failed to process image ${i} for ${day.dayOfWeek}:`, error);
          totalFailed++;
        }
      }
    }

    if (totalProcessed === 0) {
      await fs.rm(exportPath, { recursive: true, force: true });
      return NextResponse.json(
        { error: 'No images were successfully processed' },
        { status: 500 }
      );
    }

    // Create metadata.json
    const metadata = {
      weekStart: weekPlan.weekStartDate,
      exportedAt: new Date().toISOString(),
      totalImages: totalProcessed,
      failedImages: totalFailed,
      days: weekPlan.days
        .filter((d) => d.status === 'complete' || d.status === 'captions-selected')
        .map((day) => ({
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          images: day.images
            .filter((img) => img.selectedCaption)
            .map((img, index) => ({
              filename: `${day.dayOfWeek.toLowerCase()}-${String(index + 1).padStart(2, '0')}-${slugify(img.selectedCaption!.category)}.jpg`,
              caption: img.selectedCaption!.text,
              category: img.selectedCaption!.category,
              brandVoiceScore: img.selectedCaption!.brandVoiceScore,
              x: img.overlaySettings.x ?? 50,
              y: img.overlaySettings.y ?? 80,
              fontSize: img.overlaySettings.fontSize ?? 48,
              textColor: img.overlaySettings.textColor,
            })),
        })),
    };

    await fs.writeFile(
      path.join(exportPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Create ZIP file
    const zipPath = path.join(getExportsPath(), `${exportName}.zip`);
    await createZipArchive(exportPath, zipPath);

    // Read the ZIP file
    const zipBuffer = await fs.readFile(zipPath);
    const zipBase64 = zipBuffer.toString('base64');

    // Clean up the export directory (keep the ZIP)
    await fs.rm(exportPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      exportName,
      totalImages: totalProcessed,
      failedImages: totalFailed,
      daysExported: daysWithContent.length,
      downloadUrl: `/api/export/download?file=${exportName}.zip`,
      zipBase64,
    });
  } catch (error) {
    console.error('Week export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

async function createZipArchive(
  sourceDir: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
