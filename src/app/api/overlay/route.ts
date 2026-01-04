/**
 * Caption Overlay API Route
 * Overlay captions on images and return the result
 * Supports percentage-based positioning and color options (black, white, accent)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  overlayCaptionFromUrl,
  overlayCaptionAsBase64,
  batchOverlayCaptions,
  getImageColorOptions,
  processImageFromUrlForExport,
  type OverlayOptions,
  type TextColorOption,
} from '@/lib/overlay-service';

export const maxDuration = 60; // Allow 1 minute for processing

/**
 * POST: Overlay caption on image(s)
 * Body:
 * - imageUrl: string - Single image URL
 * - caption: string - Caption text
 * - items: Array<{imageUrl, caption, options?}> - For batch processing
 * - options: OverlayOptions - Styling options
 * - returnType: 'buffer' | 'base64' | 'image' - How to return the result
 * - cropFor4x5: boolean - Whether to crop to 4:5 aspect ratio (Instagram portrait)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      imageUrl,
      caption,
      items,
      options = {},
      returnType = 'base64',
      cropFor5x4 = false,
      getColors = false, // Just get color options without processing
    } = body;

    // Get color options only
    if (getColors && imageUrl) {
      const colors = await getImageColorOptions(imageUrl);
      return NextResponse.json({
        success: true,
        colors,
      });
    }

    // Batch processing
    if (items && Array.isArray(items) && items.length > 0) {
      if (items.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 images per batch' },
          { status: 400 }
        );
      }

      // For batch, items can have their own options
      const batchItems = items.map((item: { imageUrl: string; caption: string; options?: Partial<OverlayOptions> }) => ({
        imageUrl: item.imageUrl,
        caption: item.caption,
        options: item.options,
      }));

      const buffers = await batchOverlayCaptions(batchItems, options as Partial<OverlayOptions>);

      if (returnType === 'base64') {
        const base64Results = buffers.map(buf => buf.toString('base64'));
        return NextResponse.json({
          success: true,
          count: base64Results.length,
          images: base64Results.map((b64, i) => ({
            base64: b64,
            caption: items[i].caption,
            imageUrl: items[i].imageUrl,
          })),
        });
      }

      // Return first image as binary for batch
      return new NextResponse(new Uint8Array(buffers[0]), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': 'inline; filename="overlay.jpg"',
        },
      });
    }

    // Single image processing
    if (!imageUrl || !caption) {
      return NextResponse.json(
        { error: 'imageUrl and caption are required' },
        { status: 400 }
      );
    }

    // Process with optional 4:5 crop (Instagram portrait)
    if (cropFor5x4) {
      const buffer = await processImageFromUrlForExport(imageUrl, caption, options as Partial<OverlayOptions>);

      if (returnType === 'base64') {
        return NextResponse.json({
          success: true,
          base64: buffer.toString('base64'),
          caption,
          imageUrl,
          cropped: true,
        });
      }

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': 'inline; filename="overlay-cropped.jpg"',
        },
      });
    }

    // Standard processing without crop
    if (returnType === 'base64') {
      const base64 = await overlayCaptionAsBase64(imageUrl, caption, options as Partial<OverlayOptions>);
      return NextResponse.json({
        success: true,
        base64,
        caption,
        imageUrl,
      });
    }

    const buffer = await overlayCaptionFromUrl(imageUrl, caption, options as Partial<OverlayOptions>);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline; filename="overlay.jpg"',
      },
    });
  } catch (error) {
    console.error('Overlay error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Overlay failed' },
      { status: 500 }
    );
  }
}

/**
 * GET: Preview an overlay or get API info
 * Query params:
 * - url: string - Image URL (URL encoded)
 * - caption: string - Caption text (URL encoded)
 * - x: number - Horizontal position (% from left, default 50)
 * - y: number - Vertical position (% from top, default 80)
 * - fontSize: number - Font size in pixels (default 48)
 * - textColor: 'black' | 'white' | 'accent'
 * - crop: 'true' to crop to 4:5 (Instagram portrait)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const caption = searchParams.get('caption');
    const x = searchParams.get('x');
    const y = searchParams.get('y');
    const fontSize = searchParams.get('fontSize');
    const textColor = searchParams.get('textColor') as TextColorOption | null;
    const crop = searchParams.get('crop') === 'true';
    const colorsOnly = searchParams.get('colors') === 'true';

    // Return API documentation if no params
    if (!imageUrl) {
      return NextResponse.json({
        endpoint: '/api/overlay',
        description: 'Overlay captions on images with percentage-based positioning',
        usage: {
          preview: 'GET /api/overlay?url=IMAGE_URL&caption=TEXT&x=50&y=80&textColor=white',
          getColors: 'GET /api/overlay?url=IMAGE_URL&colors=true',
          single: 'POST { imageUrl, caption, options?, returnType?, cropFor5x4? }',
          batch: 'POST { items: [{imageUrl, caption, options?}], options?, returnType? }',
        },
        options: {
          x: 'number (0-100) - Horizontal position as % from left (default: 50)',
          y: 'number (0-100) - Vertical position as % from top (default: 80)',
          fontSize: 'number (default: 48, scales with image)',
          textColor: "'black' | 'white' | 'accent' (default: white)",
          accentColor: 'string - Pre-extracted accent color hex (optional)',
        },
        features: {
          font: 'Jost bold italic',
          colors: 'Black, white, or auto-extracted accent color',
          positioning: 'Free-form percentage-based positioning',
          cropping: 'Optional 4:5 aspect ratio crop for Instagram grid (portrait)',
        },
      });
    }

    // Get color options only
    if (colorsOnly) {
      const colors = await getImageColorOptions(imageUrl);
      return NextResponse.json({
        success: true,
        colors,
      });
    }

    // Need caption for overlay
    if (!caption) {
      return NextResponse.json(
        { error: 'caption parameter is required for overlay preview' },
        { status: 400 }
      );
    }

    const options: Partial<OverlayOptions> = {};
    if (x) options.x = parseFloat(x);
    if (y) options.y = parseFloat(y);
    if (fontSize) options.fontSize = parseInt(fontSize, 10);
    if (textColor) options.textColor = textColor;

    let buffer: Buffer;
    if (crop) {
      buffer = await processImageFromUrlForExport(imageUrl, caption, options);
    } else {
      buffer = await overlayCaptionFromUrl(imageUrl, caption, options);
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline; filename="preview.jpg"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Overlay preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    );
  }
}
