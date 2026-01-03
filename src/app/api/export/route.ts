/**
 * Export API Route
 * Handles exporting carousels as downloadable files
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';
import {
  getCarousels,
  createExportDirectory,
  getExportsPath,
} from '@/lib/storage-service';
import { formatDateForFile, sanitizeFilename } from '@/lib/utils';
import type { CarouselContent, ExportOptions } from '@/types';

export const maxDuration = 60;

/**
 * POST: Export carousels as a ZIP file
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      carouselIds, // Array of carousel IDs to export
      options, // ExportOptions
    } = body as { carouselIds: string[]; options: ExportOptions };

    if (!carouselIds || carouselIds.length === 0) {
      return NextResponse.json(
        { error: 'No carousels specified for export' },
        { status: 400 }
      );
    }

    // Get carousels
    const allCarousels = await getCarousels();
    const carousels = allCarousels.filter((c) => carouselIds.includes(c.id));

    if (carousels.length === 0) {
      return NextResponse.json(
        { error: 'No matching carousels found' },
        { status: 404 }
      );
    }

    // Create export directory
    const exportName = `break-free-export-${Date.now()}`;
    const exportPath = await createExportDirectory(exportName);

    // Process each carousel
    for (const carousel of carousels) {
      const carouselDir = path.join(
        exportPath,
        formatDateForFile(carousel.date)
      );
      await fs.mkdir(carouselDir, { recursive: true });

      // Download and save images
      const imagePromises = carousel.items.map(async (item, index) => {
        const imageName = getImageName(carousel, item, index, options);
        const imagePath = path.join(carouselDir, imageName);

        try {
          // Download image
          const response = await fetch(item.image.url);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await fs.writeFile(imagePath, buffer);

          return { index, success: true, path: imagePath };
        } catch (error) {
          console.error(`Failed to download image ${index}:`, error);
          return { index, success: false, error };
        }
      });

      await Promise.all(imagePromises);

      // Create captions file
      if (options.includeMetadata) {
        const captionsPath = path.join(
          carouselDir,
          `captions.${options.captionFormat || 'json'}`
        );
        const captionsData = formatCaptions(carousel, options.captionFormat);
        await fs.writeFile(captionsPath, captionsData);

        // Create metadata file
        const metadataPath = path.join(carouselDir, 'metadata.json');
        const metadata = {
          date: carousel.date,
          theme: carousel.theme,
          themeDescription: carousel.themeDescription,
          imageMode: carousel.imageMode,
          brandVoiceScore: carousel.brandVoiceScore,
          createdAt: carousel.createdAt,
          items: carousel.items.map((item, index) => ({
            index,
            caption: item.caption.text,
            category: item.caption.category,
            brandVoiceScore: item.caption.brandVoiceScore,
            imageSource: item.image.source,
            imageAttribution: item.image.attribution,
          })),
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }
    }

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
      carouselsExported: carousels.length,
      downloadUrl: `/api/export/download?file=${exportName}.zip`,
      zipBase64, // Include base64 for direct download
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Download an exported ZIP file
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(getExportsPath(), sanitizedFilename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read and return the file
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}

// Helper functions

function getImageName(
  carousel: CarouselContent,
  item: CarouselContent['items'][0],
  index: number,
  options: ExportOptions
): string {
  const ext = 'jpg';

  switch (options.namingConvention) {
    case 'theme-index':
      return `${sanitizeFilename(carousel.theme)}_${index + 1}.${ext}`;
    case 'caption-preview':
      const preview = sanitizeFilename(item.caption.text.slice(0, 30));
      return `${index + 1}_${preview}.${ext}`;
    case 'date-index':
    default:
      return `${formatDateForFile(carousel.date)}_${index + 1}.${ext}`;
  }
}

function formatCaptions(
  carousel: CarouselContent,
  format: string = 'json'
): string {
  const captions = carousel.items.map((item, index) => ({
    index: index + 1,
    caption: item.caption.text,
    category: item.caption.category,
  }));

  switch (format) {
    case 'csv':
      const headers = 'index,caption,category';
      const rows = captions.map(
        (c) => `${c.index},"${c.caption.replace(/"/g, '""')}",${c.category}`
      );
      return [headers, ...rows].join('\n');

    case 'txt':
      return captions
        .map((c) => `${c.index}. ${c.caption}`)
        .join('\n\n');

    case 'json':
    default:
      return JSON.stringify(captions, null, 2);
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
