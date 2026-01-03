import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines clsx and tailwind-merge for conditional class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date for file naming
 */
export function formatDateForFile(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Get the start of a week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Generate an array of dates for a week
 */
export function getWeekDates(startDate: Date = getWeekStart()): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Calculate brand voice similarity score
 */
export function calculateBrandVoiceScore(
  caption: string,
  profile: {
    averageCaptionLength: number;
    commonPhrases: string[];
    toneMarkers: string[];
  }
): number {
  let score = 50; // Base score

  // Length similarity (±20 points)
  const lengthDiff = Math.abs(caption.length - profile.averageCaptionLength);
  const lengthScore = Math.max(0, 20 - lengthDiff / 5);
  score += lengthScore;

  // Common phrases (up to 15 points)
  const lowerCaption = caption.toLowerCase();
  const phraseMatches = profile.commonPhrases.filter((phrase) =>
    lowerCaption.includes(phrase.toLowerCase())
  ).length;
  score += Math.min(15, phraseMatches * 5);

  // Tone markers (up to 15 points)
  const toneMatches = profile.toneMarkers.filter((marker) =>
    lowerCaption.includes(marker.toLowerCase())
  ).length;
  score += Math.min(15, toneMatches * 5);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Delay utility for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch process items with delay
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize: number = 5,
  delayMs: number = 1000
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item, i + index))
    );
    results.push(...batchResults);
    
    if (i + batchSize < items.length) {
      await delay(delayMs);
    }
  }
  
  return results;
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .slice(0, 50);
}

/**
 * Get image dimensions from base64
 */
export function getImageDimensions(
  base64: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Calculate percentage
 */
export function calculatePercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}
