/**
 * Cosmos.so Scraper Service
 * Fetches curated images from cosmos.so for the image-first workflow
 */

import { generateId } from '@/lib/utils';

// Types for Cosmos.so data structures
export interface CosmosCategory {
  id: number;
  name: string;
  slug: string;
}

export interface CosmosCluster {
  id: number;
  name: string;
  slug: string;
  ownerUsername: string;
  coverImageUrl: string;
  numberOfElements: number;
  followersCount: number;
}

export interface CosmosElement {
  id: number;
  type: 'IMAGE' | 'INSTAGRAM' | 'PINTEREST';
  url: string;
  imageUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  blurHash?: string;
  computerVisionTags: string[];
  generatedCaption?: string;
}

export interface CosmosImage {
  id: string;
  cosmosId: number;
  url: string;
  highResUrl: string;
  width: number;
  height: number;
  tags: string[];
  caption?: string;
  sourceCluster?: string;
}

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

async function rateLimitedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  return fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });
}

// Base URL for cosmos (they redirect to www)
const COSMOS_BASE_URL = 'https://www.cosmos.so';

// Extract Apollo state or Next.js data from HTML page
async function extractApolloState(path: string): Promise<Record<string, unknown>> {
  const url = `${COSMOS_BASE_URL}${path}`;
  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();

  // Try to find __APOLLO_STATE__ (older Next.js pattern)
  const apolloMatch = html.match(/__APOLLO_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
  if (apolloMatch) {
    try {
      return JSON.parse(apolloMatch[1]);
    } catch {
      // Continue to try other patterns
    }
  }

  // Try Next.js __NEXT_DATA__ pattern
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Apollo state might be nested in props - cosmos uses initialApolloState
      if (nextData.props?.pageProps?.initialApolloState) {
        return nextData.props.pageProps.initialApolloState;
      }
      if (nextData.props?.pageProps?.apolloState) {
        return nextData.props.pageProps.apolloState;
      }
      if (nextData.props?.pageProps?.__APOLLO_STATE__) {
        return nextData.props.pageProps.__APOLLO_STATE__;
      }
      // Return the full props as fallback
      return nextData.props?.pageProps || nextData;
    } catch {
      throw new Error('Failed to parse __NEXT_DATA__');
    }
  }

  // Try to find Apollo state in any script tag
  const scriptMatch = html.match(/"__APOLLO_STATE__"\s*:\s*({[^}]+(?:{[^}]*}[^}]*)*})/);
  if (scriptMatch) {
    try {
      return JSON.parse(scriptMatch[1]);
    } catch {
      // Continue
    }
  }

  // Last resort: look for any JSON with Category or Cluster data
  const jsonMatch = html.match(/\{"Category:[^"]+/);
  if (jsonMatch) {
    // Try to extract the full JSON object
    const startIndex = html.indexOf(jsonMatch[0]) - 1;
    let depth = 0;
    let endIndex = startIndex;
    for (let i = startIndex; i < html.length && i < startIndex + 100000; i++) {
      if (html[i] === '{') depth++;
      if (html[i] === '}') depth--;
      if (depth === 0 && i > startIndex) {
        endIndex = i + 1;
        break;
      }
    }
    if (endIndex > startIndex) {
      try {
        return JSON.parse(html.slice(startIndex, endIndex));
      } catch {
        // Continue
      }
    }
  }

  throw new Error('Could not find data in page. The site may require JavaScript rendering.');
}

// Extract data from Apollo state cache
function extractFromApolloCache<T>(
  apolloState: Record<string, unknown>,
  typeName: string
): T[] {
  const results: T[] = [];

  for (const [key, value] of Object.entries(apolloState)) {
    if (key.startsWith(typeName + ':') && value && typeof value === 'object') {
      results.push(value as T);
    }
  }

  return results;
}

/**
 * Get all available categories by scraping the discover page
 */
export async function getCategories(): Promise<CosmosCategory[]> {
  const apolloState = await extractApolloState('/discover');

  const categories = extractFromApolloCache<{
    id: number;
    name: string;
    slug: string;
  }>(apolloState, 'Category');

  return categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
  }));
}

/**
 * Get featured clusters by scraping the home/discover page
 */
export async function getFeaturedClusters(
  limit: number = 20
): Promise<{ clusters: CosmosCluster[]; nextCursor?: string }> {
  const apolloState = await extractApolloState('/home');

  interface ApolloCluster {
    id: number;
    name: string;
    slug: string;
    owner?: { __ref: string } | { username: string };
    coverImageUrl?: string;
    numberOfElements?: number;
    followersCount?: number;
  }

  const rawClusters = extractFromApolloCache<ApolloCluster>(apolloState, 'Cluster');

  const clusters = rawClusters.slice(0, limit).map(cluster => {
    // Resolve owner reference if needed
    let ownerUsername = 'unknown';
    if (cluster.owner) {
      if ('username' in cluster.owner) {
        ownerUsername = cluster.owner.username;
      } else if ('__ref' in cluster.owner) {
        const ownerRef = apolloState[cluster.owner.__ref] as { username?: string } | undefined;
        ownerUsername = ownerRef?.username || 'unknown';
      }
    }

    return {
      id: cluster.id,
      name: cluster.name,
      slug: cluster.slug,
      ownerUsername,
      coverImageUrl: cluster.coverImageUrl || '',
      numberOfElements: cluster.numberOfElements || 0,
      followersCount: cluster.followersCount || 0,
    };
  });

  return { clusters, nextCursor: undefined };
}

/**
 * Get clusters by category slug
 */
export async function getClustersByCategory(
  categorySlug: string,
  limit: number = 20
): Promise<{ clusters: CosmosCluster[]; nextCursor?: string }> {
  const apolloState = await extractApolloState(`/discover/${categorySlug}`);

  interface ApolloCluster {
    id: number;
    name: string;
    slug: string;
    owner?: { __ref: string } | { username: string };
    coverImageUrl?: string;
    numberOfElements?: number;
    followersCount?: number;
  }

  const rawClusters = extractFromApolloCache<ApolloCluster>(apolloState, 'Cluster');

  const clusters = rawClusters.slice(0, limit).map(cluster => {
    let ownerUsername = 'unknown';
    if (cluster.owner) {
      if ('username' in cluster.owner) {
        ownerUsername = cluster.owner.username;
      } else if ('__ref' in cluster.owner) {
        const ownerRef = apolloState[cluster.owner.__ref] as { username?: string } | undefined;
        ownerUsername = ownerRef?.username || 'unknown';
      }
    }

    return {
      id: cluster.id,
      name: cluster.name,
      slug: cluster.slug,
      ownerUsername,
      coverImageUrl: cluster.coverImageUrl || '',
      numberOfElements: cluster.numberOfElements || 0,
      followersCount: cluster.followersCount || 0,
    };
  });

  return { clusters, nextCursor: undefined };
}

/**
 * Get elements from a specific cluster by username/slug
 */
export async function getClusterElements(
  username: string,
  clusterSlug: string,
  limit: number = 50
): Promise<{ elements: CosmosElement[]; nextCursor?: string }> {
  const apolloState = await extractApolloState(`/${username}/${clusterSlug}`);

  interface ApolloElement {
    id: number;
    type?: string;
    url?: string;
    image?: {
      url?: string;
      width?: number;
      height?: number;
      aspectRatio?: number;
      hash?: string;
    } | { __ref: string };
    computerVisionTags?: string[];
    generatedCaption?: { text?: string } | { __ref: string };
  }

  // Try multiple element type names
  const rawElements = extractFromApolloCache<ApolloElement>(apolloState, 'ImageElement');
  const instagramElements = extractFromApolloCache<ApolloElement>(apolloState, 'InstagramElement');
  const pinterestElements = extractFromApolloCache<ApolloElement>(apolloState, 'PinterestElement');
  const interfaceElements = extractFromApolloCache<ApolloElement>(apolloState, 'ElementInterface');

  const allRawElements = [...rawElements, ...instagramElements, ...pinterestElements, ...interfaceElements];

  const elements: CosmosElement[] = allRawElements.slice(0, limit).map(el => {
    // Resolve image reference
    let imageData = { url: '', width: 0, height: 0, aspectRatio: 1, hash: '' };
    if (el.image) {
      if ('__ref' in el.image) {
        const imageRef = apolloState[el.image.__ref] as typeof imageData | undefined;
        if (imageRef) {
          imageData = {
            url: imageRef.url || '',
            width: imageRef.width || 0,
            height: imageRef.height || 0,
            aspectRatio: imageRef.aspectRatio || 1,
            hash: imageRef.hash || '',
          };
        }
      } else {
        imageData = {
          url: el.image.url || '',
          width: el.image.width || 0,
          height: el.image.height || 0,
          aspectRatio: el.image.aspectRatio || 1,
          hash: el.image.hash || '',
        };
      }
    }

    // Resolve caption reference
    let caption: string | undefined;
    if (el.generatedCaption) {
      if ('__ref' in el.generatedCaption) {
        const captionRef = apolloState[el.generatedCaption.__ref] as { text?: string } | undefined;
        caption = captionRef?.text;
      } else {
        caption = el.generatedCaption.text;
      }
    }

    return {
      id: el.id,
      type: (el.type as 'IMAGE' | 'INSTAGRAM' | 'PINTEREST') || 'IMAGE',
      url: el.url || '',
      imageUrl: imageData.url,
      width: imageData.width,
      height: imageData.height,
      aspectRatio: imageData.aspectRatio,
      blurHash: imageData.hash,
      computerVisionTags: el.computerVisionTags || [],
      generatedCaption: caption,
    };
  }).filter(el => el.imageUrl); // Only return elements with valid image URLs

  return { elements, nextCursor: undefined };
}

/**
 * Get featured elements from discover page
 */
export async function getFeaturedElements(
  categorySlug?: string,
  limit: number = 50
): Promise<{ elements: CosmosElement[]; nextCursor?: string }> {
  const path = categorySlug ? `/discover/${categorySlug}` : '/discover';
  const apolloState = await extractApolloState(path);

  interface ApolloElement {
    id: number;
    type?: string;
    url?: string;
    image?: {
      url?: string;
      width?: number;
      height?: number;
      aspectRatio?: number;
      hash?: string;
    } | { __ref: string };
    computerVisionTags?: string[];
    generatedCaption?: { text?: string } | { __ref: string };
  }

  const rawElements = extractFromApolloCache<ApolloElement>(apolloState, 'ImageElement');

  const elements: CosmosElement[] = rawElements.slice(0, limit).map(el => {
    let imageData = { url: '', width: 0, height: 0, aspectRatio: 1, hash: '' };
    if (el.image) {
      if ('__ref' in el.image) {
        const imageRef = apolloState[el.image.__ref] as typeof imageData | undefined;
        if (imageRef) {
          imageData = {
            url: imageRef.url || '',
            width: imageRef.width || 0,
            height: imageRef.height || 0,
            aspectRatio: imageRef.aspectRatio || 1,
            hash: imageRef.hash || '',
          };
        }
      } else {
        imageData = {
          url: el.image.url || '',
          width: el.image.width || 0,
          height: el.image.height || 0,
          aspectRatio: el.image.aspectRatio || 1,
          hash: el.image.hash || '',
        };
      }
    }

    let caption: string | undefined;
    if (el.generatedCaption) {
      if ('__ref' in el.generatedCaption) {
        const captionRef = apolloState[el.generatedCaption.__ref] as { text?: string } | undefined;
        caption = captionRef?.text;
      } else {
        caption = el.generatedCaption.text;
      }
    }

    return {
      id: el.id,
      type: (el.type as 'IMAGE' | 'INSTAGRAM' | 'PINTEREST') || 'IMAGE',
      url: el.url || '',
      imageUrl: imageData.url,
      width: imageData.width,
      height: imageData.height,
      aspectRatio: imageData.aspectRatio,
      blurHash: imageData.hash,
      computerVisionTags: el.computerVisionTags || [],
      generatedCaption: caption,
    };
  }).filter(el => el.imageUrl);

  return { elements, nextCursor: undefined };
}

/**
 * Find similar images based on computerVisionTags
 * Returns images that share the most tags with the seed image
 */
export function findSimilarImages(
  seedElement: CosmosElement,
  allElements: CosmosElement[],
  minSimilarity: number = 0.3,
  limit: number = 10
): CosmosElement[] {
  const seedTags = new Set(seedElement.computerVisionTags.map(t => t.toLowerCase()));

  if (seedTags.size === 0) {
    // If no tags, return elements with similar aspect ratios
    return allElements
      .filter(el => el.id !== seedElement.id)
      .filter(el => Math.abs(el.aspectRatio - seedElement.aspectRatio) < 0.2)
      .slice(0, limit);
  }

  const scored = allElements
    .filter(el => el.id !== seedElement.id)
    .map(el => {
      const elTags = new Set(el.computerVisionTags.map(t => t.toLowerCase()));
      const intersection = Array.from(seedTags).filter(t => elTags.has(t)).length;
      const union = new Set(Array.from(seedTags).concat(Array.from(elTags))).size;
      const similarity = union > 0 ? intersection / union : 0;
      return { element: el, similarity };
    })
    .filter(item => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, limit).map(item => item.element);
}

/**
 * Convert Cosmos element to our CosmosImage format
 */
export function elementToImage(
  element: CosmosElement,
  sourceCluster?: string
): CosmosImage {
  // Get high-res URL by adjusting the width parameter
  const highResUrl = element.imageUrl.includes('?')
    ? element.imageUrl.replace(/w=\d+/, 'w=1080')
    : `${element.imageUrl}?format=webp&w=1080`;

  return {
    id: generateId(),
    cosmosId: element.id,
    url: element.imageUrl,
    highResUrl,
    width: element.width,
    height: element.height,
    tags: element.computerVisionTags,
    caption: element.generatedCaption,
    sourceCluster,
  };
}

/**
 * Download image as buffer
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await rateLimitedFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download image as base64
 */
export async function downloadImageAsBase64(url: string): Promise<string> {
  const buffer = await downloadImage(url);
  return buffer.toString('base64');
}
