/**
 * Library Management API Route
 * CRUD operations for library images
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLibraryImages,
  updateLibraryImage,
  deleteLibraryImage,
  initializeDataDirectory,
} from '@/lib/storage-service';

/**
 * GET: Retrieve all library images
 */
export async function GET() {
  try {
    await initializeDataDirectory();
    const images = await getLibraryImages();

    return NextResponse.json({
      success: true,
      count: images.length,
      images: images.map((img) => ({
        id: img.id,
        filename: img.filename,
        extractedCaption: img.extractedCaption,
        captionConfidence: img.captionConfidence,
        manuallyVerified: img.manuallyVerified,
        analyzedTheme: img.analyzedTheme,
        analyzedAesthetic: img.analyzedAesthetic,
        isFavorite: img.isFavorite,
        uploadedAt: img.uploadedAt,
      })),
    });
  } catch (error) {
    console.error('Get library error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get library' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a library image (caption correction, favorite toggle, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Validate allowed updates
    const allowedFields = [
      'extractedCaption',
      'manuallyVerified',
      'isFavorite',
      'analyzedTheme',
      'analyzedAesthetic',
    ];

    const sanitizedUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = value;
      }
    }

    // If caption is being corrected, mark as manually verified
    if ('extractedCaption' in sanitizedUpdates) {
      sanitizedUpdates.manuallyVerified = true;
      sanitizedUpdates.captionConfidence = 1.0;
    }

    await updateLibraryImage(id, sanitizedUpdates);

    return NextResponse.json({
      success: true,
      message: 'Image updated successfully',
    });
  } catch (error) {
    console.error('Update library image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove an image from the library
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    await deleteLibraryImage(id);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Delete library image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
