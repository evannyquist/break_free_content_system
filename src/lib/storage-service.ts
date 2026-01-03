/**
 * Data Storage Service
 * Handles persistent storage for:
 * - Content library (uploaded images and extracted captions)
 * - Brand voice profile
 * - Generated content
 * - Settings and configuration
 * 
 * Uses local file system with JSON for simplicity.
 * Can be extended to use a database if needed.
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  LibraryImage,
  BrandVoiceProfile,
  CarouselContent,
  WeeklyContent,
  GenerationSettings,
  ApiUsageStats,
} from '@/types';

// Base data directory
const DATA_DIR = process.env.DATA_DIR || './data';

// Subdirectories
const PATHS = {
  library: path.join(DATA_DIR, 'library'),
  libraryImages: path.join(DATA_DIR, 'library', 'images'),
  profile: path.join(DATA_DIR, 'profile'),
  content: path.join(DATA_DIR, 'content'),
  exports: path.join(DATA_DIR, 'exports'),
  settings: path.join(DATA_DIR, 'settings'),
};

// =====================================
// Initialization
// =====================================

/**
 * Initialize the data directory structure
 */
export async function initializeDataDirectory(): Promise<void> {
  for (const dir of Object.values(PATHS)) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Create default files if they don't exist
  const defaultSettings: GenerationSettings = {
    imageMode: 'stock',
    stockSource: 'both',
    brandVoiceStrictness: 70,
    imageStyle: 'epic cinematic',
    imageQuality: 'standard',
    themeCategories: [],
    excludedThemes: [],
  };

  const settingsPath = path.join(PATHS.settings, 'settings.json');
  try {
    await fs.access(settingsPath);
  } catch {
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
  }

  // Initialize usage stats
  const usagePath = path.join(PATHS.settings, 'usage.json');
  try {
    await fs.access(usagePath);
  } catch {
    const defaultUsage: ApiUsageStats = {
      anthropicCalls: 0,
      anthropicTokens: 0,
      openaiCalls: 0,
      pexelsCalls: 0,
      unsplashCalls: 0,
      lastUpdated: new Date().toISOString(),
    };
    await fs.writeFile(usagePath, JSON.stringify(defaultUsage, null, 2));
  }
}

// =====================================
// Library Management
// =====================================

/**
 * Get all library images
 */
export async function getLibraryImages(): Promise<LibraryImage[]> {
  const indexPath = path.join(PATHS.library, 'index.json');
  
  try {
    const data = await fs.readFile(indexPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save a library image
 */
export async function saveLibraryImage(image: LibraryImage): Promise<void> {
  // Save the image file if base64 is provided
  if (image.base64) {
    const imagePath = path.join(PATHS.libraryImages, image.filename);
    const buffer = Buffer.from(image.base64, 'base64');
    await fs.writeFile(imagePath, buffer);
    
    // Remove base64 from the index entry to save space
    delete image.base64;
    image.filepath = imagePath;
  }

  // Update the index
  const images = await getLibraryImages();
  const existingIndex = images.findIndex((img) => img.id === image.id);
  
  if (existingIndex >= 0) {
    images[existingIndex] = image;
  } else {
    images.push(image);
  }

  await fs.writeFile(
    path.join(PATHS.library, 'index.json'),
    JSON.stringify(images, null, 2)
  );
}

/**
 * Save multiple library images
 */
export async function saveLibraryImages(newImages: LibraryImage[]): Promise<void> {
  const existingImages = await getLibraryImages();
  
  for (const image of newImages) {
    // Save the image file if base64 is provided
    if (image.base64) {
      const imagePath = path.join(PATHS.libraryImages, image.filename);
      const buffer = Buffer.from(image.base64, 'base64');
      await fs.writeFile(imagePath, buffer);
      
      // Update filepath and remove base64
      image.filepath = imagePath;
      delete image.base64;
    }
  }

  // Merge with existing images
  const imageMap = new Map(existingImages.map((img) => [img.id, img]));
  for (const img of newImages) {
    imageMap.set(img.id, img);
  }

  await fs.writeFile(
    path.join(PATHS.library, 'index.json'),
    JSON.stringify(Array.from(imageMap.values()), null, 2)
  );
}

/**
 * Update a library image
 */
export async function updateLibraryImage(
  id: string,
  updates: Partial<LibraryImage>
): Promise<void> {
  const images = await getLibraryImages();
  const index = images.findIndex((img) => img.id === id);
  
  if (index >= 0) {
    images[index] = { ...images[index], ...updates };
    await fs.writeFile(
      path.join(PATHS.library, 'index.json'),
      JSON.stringify(images, null, 2)
    );
  }
}

/**
 * Delete a library image
 */
export async function deleteLibraryImage(id: string): Promise<void> {
  const images = await getLibraryImages();
  const image = images.find((img) => img.id === id);
  
  if (image) {
    // Delete the image file
    try {
      await fs.unlink(image.filepath);
    } catch {
      // File might not exist, continue
    }

    // Update the index
    const updatedImages = images.filter((img) => img.id !== id);
    await fs.writeFile(
      path.join(PATHS.library, 'index.json'),
      JSON.stringify(updatedImages, null, 2)
    );
  }
}

/**
 * Get library image as base64
 */
export async function getLibraryImageBase64(id: string): Promise<string | null> {
  const images = await getLibraryImages();
  const image = images.find((img) => img.id === id);
  
  if (image?.filepath) {
    try {
      const buffer = await fs.readFile(image.filepath);
      return buffer.toString('base64');
    } catch {
      return null;
    }
  }
  
  return null;
}

// =====================================
// Brand Voice Profile
// =====================================

/**
 * Get the brand voice profile
 */
export async function getBrandVoiceProfile(): Promise<BrandVoiceProfile | null> {
  const profilePath = path.join(PATHS.profile, 'brand-voice.json');
  
  try {
    const data = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save the brand voice profile
 */
export async function saveBrandVoiceProfile(
  profile: BrandVoiceProfile
): Promise<void> {
  await fs.writeFile(
    path.join(PATHS.profile, 'brand-voice.json'),
    JSON.stringify(profile, null, 2)
  );
}

/**
 * Update the brand voice profile
 */
export async function updateBrandVoiceProfile(
  updates: Partial<BrandVoiceProfile>
): Promise<void> {
  const profile = await getBrandVoiceProfile();
  
  if (profile) {
    const updatedProfile = { ...profile, ...updates, updatedAt: new Date().toISOString() };
    await saveBrandVoiceProfile(updatedProfile);
  }
}

// =====================================
// Content Management
// =====================================

/**
 * Get all carousels
 */
export async function getCarousels(): Promise<CarouselContent[]> {
  const contentPath = path.join(PATHS.content, 'carousels.json');
  
  try {
    const data = await fs.readFile(contentPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save a carousel
 */
export async function saveCarousel(carousel: CarouselContent): Promise<void> {
  const carousels = await getCarousels();
  const existingIndex = carousels.findIndex((c) => c.id === carousel.id);
  
  if (existingIndex >= 0) {
    carousels[existingIndex] = carousel;
  } else {
    carousels.push(carousel);
  }

  await fs.writeFile(
    path.join(PATHS.content, 'carousels.json'),
    JSON.stringify(carousels, null, 2)
  );
}

/**
 * Get carousels for a specific date range
 */
export async function getCarouselsByDateRange(
  startDate: string,
  endDate: string
): Promise<CarouselContent[]> {
  const carousels = await getCarousels();
  
  return carousels.filter((c) => {
    const date = new Date(c.date);
    return date >= new Date(startDate) && date <= new Date(endDate);
  });
}

/**
 * Delete a carousel
 */
export async function deleteCarousel(id: string): Promise<void> {
  const carousels = await getCarousels();
  const updatedCarousels = carousels.filter((c) => c.id !== id);
  
  await fs.writeFile(
    path.join(PATHS.content, 'carousels.json'),
    JSON.stringify(updatedCarousels, null, 2)
  );
}

// =====================================
// Settings Management
// =====================================

/**
 * Get generation settings
 */
export async function getSettings(): Promise<GenerationSettings> {
  const settingsPath = path.join(PATHS.settings, 'settings.json');
  
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Return defaults
    return {
      imageMode: 'stock',
      stockSource: 'both',
      brandVoiceStrictness: 70,
      imageStyle: 'epic cinematic',
      imageQuality: 'standard',
      themeCategories: [],
      excludedThemes: [],
    };
  }
}

/**
 * Save generation settings
 */
export async function saveSettings(settings: GenerationSettings): Promise<void> {
  await fs.writeFile(
    path.join(PATHS.settings, 'settings.json'),
    JSON.stringify(settings, null, 2)
  );
}

// =====================================
// API Usage Tracking
// =====================================

/**
 * Get API usage stats
 */
export async function getApiUsageStats(): Promise<ApiUsageStats> {
  const usagePath = path.join(PATHS.settings, 'usage.json');
  
  try {
    const data = await fs.readFile(usagePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      anthropicCalls: 0,
      anthropicTokens: 0,
      openaiCalls: 0,
      pexelsCalls: 0,
      unsplashCalls: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Update API usage stats
 */
export async function updateApiUsageStats(
  updates: Partial<ApiUsageStats>
): Promise<void> {
  const stats = await getApiUsageStats();
  const updatedStats = {
    ...stats,
    ...updates,
    anthropicCalls: stats.anthropicCalls + (updates.anthropicCalls || 0),
    anthropicTokens: stats.anthropicTokens + (updates.anthropicTokens || 0),
    openaiCalls: stats.openaiCalls + (updates.openaiCalls || 0),
    pexelsCalls: stats.pexelsCalls + (updates.pexelsCalls || 0),
    unsplashCalls: stats.unsplashCalls + (updates.unsplashCalls || 0),
    lastUpdated: new Date().toISOString(),
  };
  
  await fs.writeFile(
    path.join(PATHS.settings, 'usage.json'),
    JSON.stringify(updatedStats, null, 2)
  );
}

// =====================================
// Export Utilities
// =====================================

/**
 * Get the exports directory path
 */
export function getExportsPath(): string {
  return PATHS.exports;
}

/**
 * Create a dated export directory
 */
export async function createExportDirectory(name: string): Promise<string> {
  const exportPath = path.join(PATHS.exports, name);
  await fs.mkdir(exportPath, { recursive: true });
  return exportPath;
}
