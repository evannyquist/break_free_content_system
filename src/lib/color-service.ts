/**
 * Color Service
 * Extract colors from images and calculate contrast
 */

import sharp from 'sharp';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorInfo {
  hex: string;
  rgb: RGB;
  saturation: number;
  luminance: number;
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate relative luminance for contrast ratio
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getRelativeLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
export function getContrastRatio(color1: RGB, color2: RGB): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate saturation of a color (0-1)
 */
function getSaturation(rgb: RGB): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Extract dominant colors from an image using sharp
 */
export async function extractDominantColors(
  imageBuffer: Buffer,
  numColors: number = 5
): Promise<ColorInfo[]> {
  // Resize for faster processing
  const { data, info } = await sharp(imageBuffer)
    .resize(50, 50, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build color histogram
  const colorMap = new Map<string, { count: number; rgb: RGB }>();

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Quantize colors to reduce noise (group similar colors)
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;

    const key = `${qr},${qg},${qb}`;
    const existing = colorMap.get(key);

    if (existing) {
      existing.count++;
      // Average the actual colors
      existing.rgb.r = (existing.rgb.r * (existing.count - 1) + r) / existing.count;
      existing.rgb.g = (existing.rgb.g * (existing.count - 1) + g) / existing.count;
      existing.rgb.b = (existing.rgb.b * (existing.count - 1) + b) / existing.count;
    } else {
      colorMap.set(key, { count: 1, rgb: { r, g, b } });
    }
  }

  // Sort by frequency and get top colors
  const sortedColors = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, numColors * 2); // Get more than needed for filtering

  // Convert to ColorInfo and calculate properties
  const colorInfos: ColorInfo[] = sortedColors.map(({ rgb }) => ({
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    saturation: getSaturation(rgb),
    luminance: getRelativeLuminance(rgb),
  }));

  return colorInfos.slice(0, numColors);
}

/**
 * Find the best accent color from an image
 * Prioritizes saturated colors while avoiding near-black and near-white
 */
export async function extractAccentColor(
  imageBuffer: Buffer
): Promise<string | null> {
  const colors = await extractDominantColors(imageBuffer, 10);

  // Filter out near-black and near-white colors
  const candidateColors = colors.filter(c => {
    const { r, g, b } = c.rgb;
    const isNearBlack = r < 30 && g < 30 && b < 30;
    const isNearWhite = r > 225 && g > 225 && b > 225;
    const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
    return !isNearBlack && !isNearWhite && !isGray && c.saturation > 0.2;
  });

  if (candidateColors.length === 0) {
    return null; // No good accent color found
  }

  // Sort by saturation (prefer more vibrant colors)
  candidateColors.sort((a, b) => b.saturation - a.saturation);

  return candidateColors[0].hex;
}

/**
 * Get the best text color (black, white, or accent) for readability
 * Returns the color with the highest contrast ratio against the background
 */
export function getBestTextColor(
  backgroundColor: RGB,
  accentColor?: string
): 'black' | 'white' | 'accent' {
  const white: RGB = { r: 255, g: 255, b: 255 };
  const black: RGB = { r: 0, g: 0, b: 0 };

  const whiteContrast = getContrastRatio(backgroundColor, white);
  const blackContrast = getContrastRatio(backgroundColor, black);

  let accentContrast = 0;
  if (accentColor) {
    const hex = accentColor.replace('#', '');
    const accentRgb: RGB = {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
    accentContrast = getContrastRatio(backgroundColor, accentRgb);
  }

  // Prefer at least 4.5:1 contrast ratio (WCAG AA)
  const minContrast = 4.5;

  if (accentContrast >= minContrast && accentContrast >= whiteContrast && accentContrast >= blackContrast) {
    return 'accent';
  }

  return whiteContrast >= blackContrast ? 'white' : 'black';
}

/**
 * Get color options for overlay text
 * Returns black, white, and accent color (if found)
 */
export async function getTextColorOptions(
  imageBuffer: Buffer
): Promise<{
  black: string;
  white: string;
  accent: string | null;
}> {
  const accent = await extractAccentColor(imageBuffer);

  return {
    black: '#000000',
    white: '#FFFFFF',
    accent,
  };
}
