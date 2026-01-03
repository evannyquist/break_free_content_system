/**
 * Library Image Serving API Route
 * Serves library images by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLibraryImages } from '@/lib/storage-service';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const images = await getLibraryImages();
    const image = images.find((img) => img.id === id);

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Read the image file
    const imagePath = image.filepath || path.join('./data/library/images', image.filename);
    const buffer = await fs.readFile(imagePath);

    // Determine content type from filename
    const ext = path.extname(image.filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
