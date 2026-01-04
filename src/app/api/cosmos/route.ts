/**
 * Cosmos.so API Routes
 * Browse and fetch images from cosmos.so
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCategories,
  getFeaturedClusters,
  getClustersByCategory,
  getClusterElements,
  getFeaturedElements,
  findSimilarImages,
  elementToImage,
  downloadImageAsBase64,
  type CosmosElement,
} from '@/lib/cosmos-service';

/**
 * GET: Browse cosmos.so
 * Query params:
 * - action: 'categories' | 'clusters' | 'elements'
 * - categorySlug: string (for clusters by category, e.g., 'art', 'cinema')
 * - username: string (for cluster elements)
 * - clusterSlug: string (for cluster elements)
 * - limit: number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'categories';
    const categorySlug = searchParams.get('categorySlug');
    const username = searchParams.get('username');
    const clusterSlug = searchParams.get('clusterSlug');
    const limit = parseInt(searchParams.get('limit') || '20');

    switch (action) {
      case 'categories': {
        const categories = await getCategories();
        return NextResponse.json({
          success: true,
          categories,
        });
      }

      case 'clusters': {
        let result;
        if (categorySlug) {
          result = await getClustersByCategory(categorySlug, limit);
        } else {
          result = await getFeaturedClusters(limit);
        }
        return NextResponse.json({
          success: true,
          clusters: result.clusters,
          nextCursor: result.nextCursor,
        });
      }

      case 'elements': {
        let result;
        if (username && clusterSlug) {
          result = await getClusterElements(username, clusterSlug, limit);
        } else {
          result = await getFeaturedElements(categorySlug || undefined, limit);
        }

        // Convert to our image format
        const images = result.elements.map(el => elementToImage(el));

        return NextResponse.json({
          success: true,
          elements: result.elements,
          images,
          nextCursor: result.nextCursor,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cosmos API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from Cosmos' },
      { status: 500 }
    );
  }
}

/**
 * POST: Find similar images or download images
 * Body:
 * - action: 'similar' | 'download'
 * - seedElement: CosmosElement (for similar)
 * - elements: CosmosElement[] (pool to search for similar)
 * - imageUrl: string (for download)
 * - minSimilarity: number (0-1)
 * - limit: number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'similar': {
        const { seedElement, elements, minSimilarity = 0.3, limit = 10 } = body;

        if (!seedElement || !elements) {
          return NextResponse.json(
            { error: 'seedElement and elements are required' },
            { status: 400 }
          );
        }

        const similar = findSimilarImages(
          seedElement as CosmosElement,
          elements as CosmosElement[],
          minSimilarity,
          limit
        );

        const images = similar.map(el => elementToImage(el));

        return NextResponse.json({
          success: true,
          similar,
          images,
        });
      }

      case 'download': {
        const { imageUrl } = body;

        if (!imageUrl) {
          return NextResponse.json(
            { error: 'imageUrl is required' },
            { status: 400 }
          );
        }

        const base64 = await downloadImageAsBase64(imageUrl);

        return NextResponse.json({
          success: true,
          base64,
          mediaType: 'image/webp',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cosmos POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operation failed' },
      { status: 500 }
    );
  }
}
