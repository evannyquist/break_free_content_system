/**
 * Caption Overlay Service
 * Overlays text captions on images using sharp
 * Supports Jost font (bold italic), percentage-based positioning, and color options
 */

import sharp from 'sharp';
import { extractAccentColor, getTextColorOptions } from './color-service';

export type TextColorOption = 'black' | 'white' | 'accent';

export type TextAlignment = 'left' | 'center' | 'right';

export interface OverlayOptions {
  // Text positioning (percentage-based, 0-100)
  x: number;           // Horizontal position (% from left)
  y: number;           // Vertical position (% from top)
  fontSize: number;    // Font size in pixels
  width: number;       // Text box width (% of image width, 20-100)
  textAlign: TextAlignment; // Text alignment within box
  textColor: TextColorOption;
  accentColor?: string; // Pre-extracted accent color (optional)

  // Image transform settings (for crop/zoom control)
  imageScale?: number;      // Zoom level (1.0 = minimum to cover canvas, higher = more zoomed)
  imageOffsetX?: number;    // Horizontal pan (% of overflow, -50 to 50)
  imageOffsetY?: number;    // Vertical pan (% of overflow, -50 to 50)
}

export interface ColorOptions {
  black: string;
  white: string;
  accent: string | null;
}

const DEFAULT_OPTIONS: OverlayOptions = {
  x: 50,           // Center horizontally
  y: 80,           // Near bottom (80% from top)
  fontSize: 34,
  width: 80,       // 80% of image width
  textAlign: 'center',
  textColor: 'white',
};

/**
 * Wrap text to fit within a maximum width
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get the actual color hex value based on text color option
 */
function getColorHex(
  textColor: TextColorOption,
  accentColor?: string
): string {
  switch (textColor) {
    case 'black':
      return '#000000';
    case 'white':
      return '#FFFFFF';
    case 'accent':
      return accentColor || '#FFFFFF'; // Fallback to white if no accent
    default:
      return '#FFFFFF';
  }
}

/**
 * Create SVG text overlay with Jost font (bold italic)
 * Text is positioned using percentage-based x, y coordinates
 * Supports text alignment (left, center, right) within the text box width
 * No gradient background - just text with shadow for readability
 */
function createTextSvg(
  text: string,
  imageWidth: number,
  imageHeight: number,
  options: OverlayOptions & { resolvedColor: string }
): Buffer {
  const { fontSize, x, y, width: textBoxWidthPercent, textAlign, resolvedColor } = options;

  // Calculate maximum text width based on textBoxWidthPercent
  const textBoxWidth = imageWidth * (textBoxWidthPercent / 100);
  const charsPerLine = Math.floor(textBoxWidth / (fontSize * 0.55));
  const lines = wrapText(text, charsPerLine);

  const lineHeight = fontSize * 1.3;
  const textBlockHeight = lines.length * lineHeight;

  // Calculate text box position (x, y are center of the text box)
  const boxCenterX = (x / 100) * imageWidth;
  const boxLeft = boxCenterX - (textBoxWidth / 2);
  const boxRight = boxCenterX + (textBoxWidth / 2);

  // Calculate textX based on alignment
  let textX: number;
  let textAnchor: string;

  switch (textAlign) {
    case 'left':
      textX = boxLeft;
      textAnchor = 'start';
      break;
    case 'right':
      textX = boxRight;
      textAnchor = 'end';
      break;
    case 'center':
    default:
      textX = boxCenterX;
      textAnchor = 'middle';
      break;
  }

  // Convert percentage y position to absolute pixels
  // y is vertical center of text block
  const textY = (y / 100) * imageHeight - (textBlockHeight / 2) + fontSize;

  // Build text elements - using Jost font with bold italic
  // Use single quotes for font names to avoid SVG attribute escaping issues
  const fontFamily = "'Jost', 'Futura', 'Century Gothic', 'Trebuchet MS', Arial, sans-serif";

  const textLines = lines.map((line, i) => {
    const lineY = textY + (i * lineHeight);
    const escapedLine = escapeXml(line);

    // Add text shadow for better readability using SVG filter
    return `<text x="${textX}" y="${lineY}" text-anchor="${textAnchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" font-style="italic" fill="${resolvedColor}" filter="url(#textShadow)">${escapedLine}</text>`;
  }).join('\n');

  const svg = `<svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
<filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
<feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.6)"/>
</filter>
</defs>
${textLines}
</svg>`;

  return Buffer.from(svg);
}

/**
 * Overlay a caption on an image with enhanced options
 */
export async function overlayCaption(
  imageBuffer: Buffer,
  caption: string,
  options: Partial<OverlayOptions> = {}
): Promise<Buffer> {
  const opts: OverlayOptions = { ...DEFAULT_OPTIONS, ...options };

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Scale font size based on image dimensions
  const scaleFactor = Math.min(width, height) / 1080;
  opts.fontSize = Math.round(opts.fontSize * scaleFactor);

  // Resolve accent color if needed
  let accentColor = opts.accentColor;
  if (opts.textColor === 'accent' && !accentColor) {
    accentColor = await extractAccentColor(imageBuffer) || '#FFFFFF';
  }

  // Get resolved color hex
  const resolvedColor = getColorHex(opts.textColor, accentColor);

  // Create text overlay SVG
  const textSvg = createTextSvg(caption, width, height, { ...opts, accentColor, resolvedColor });

  // Composite the text overlay onto the image
  const result = await sharp(imageBuffer)
    .composite([
      {
        input: textSvg,
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();

  return result;
}

/**
 * Overlay caption on an image from URL
 */
export async function overlayCaptionFromUrl(
  imageUrl: string,
  caption: string,
  options: Partial<OverlayOptions> = {}
): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  return overlayCaption(imageBuffer, caption, options);
}

/**
 * Get color options for an image (for UI display)
 */
export async function getImageColorOptions(imageUrl: string): Promise<ColorOptions> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  return getTextColorOptions(imageBuffer);
}

/**
 * Process multiple images with their captions
 */
export async function batchOverlayCaptions(
  items: Array<{ imageUrl: string; caption: string; options?: Partial<OverlayOptions> }>,
  defaultOptions: Partial<OverlayOptions> = {}
): Promise<Buffer[]> {
  const results: Buffer[] = [];

  for (const item of items) {
    try {
      const mergedOptions = { ...defaultOptions, ...item.options };
      const processed = await overlayCaptionFromUrl(item.imageUrl, item.caption, mergedOptions);
      results.push(processed);
    } catch (error) {
      console.error(`Failed to process image ${item.imageUrl}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Get image as base64 with overlay
 */
export async function overlayCaptionAsBase64(
  imageUrl: string,
  caption: string,
  options: Partial<OverlayOptions> = {}
): Promise<string> {
  const buffer = await overlayCaptionFromUrl(imageUrl, caption, options);
  return buffer.toString('base64');
}

/**
 * Crop image to specific aspect ratio (center crop)
 */
export async function cropToAspectRatio(
  imageBuffer: Buffer,
  targetWidth: number,
  targetHeight: number
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  const targetRatio = targetWidth / targetHeight;
  const currentRatio = width / height;

  let cropWidth = width;
  let cropHeight = height;

  if (currentRatio > targetRatio) {
    // Image is wider than target - crop width
    cropWidth = Math.round(height * targetRatio);
  } else {
    // Image is taller than target - crop height
    cropHeight = Math.round(width / targetRatio);
  }

  // Center crop
  const left = Math.round((width - cropWidth) / 2);
  const top = Math.round((height - cropHeight) / 2);

  return sharp(imageBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Apply image transform (scale/pan) and crop to target aspect ratio
 * This handles the user's zoom and pan adjustments before cropping
 */
async function applyImageTransformAndCrop(
  imageBuffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  options: Partial<OverlayOptions> = {}
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width || 1080;
  const imgHeight = metadata.height || 1080;

  const targetRatio = targetWidth / targetHeight;

  // Calculate minimum scale to cover the target aspect ratio
  // This matches the canvas logic
  let minScaleX: number, minScaleY: number;
  const currentRatio = imgWidth / imgHeight;

  if (currentRatio > targetRatio) {
    // Image is wider than target - height is the constraint
    minScaleY = 1; // Use full height
    minScaleX = 1;
  } else {
    // Image is taller than target - width is the constraint
    minScaleX = 1;
    minScaleY = 1;
  }

  // Calculate the crop dimensions to achieve target aspect ratio
  let cropWidth: number, cropHeight: number;
  if (currentRatio > targetRatio) {
    // Image is wider - crop width
    cropHeight = imgHeight;
    cropWidth = Math.round(imgHeight * targetRatio);
  } else {
    // Image is taller - crop height
    cropWidth = imgWidth;
    cropHeight = Math.round(imgWidth / targetRatio);
  }

  // Apply user's scale (zoom)
  const userScale = Math.max(1, options.imageScale || 1);
  cropWidth = Math.round(cropWidth / userScale);
  cropHeight = Math.round(cropHeight / userScale);

  // Ensure we don't crop more than the image
  cropWidth = Math.min(cropWidth, imgWidth);
  cropHeight = Math.min(cropHeight, imgHeight);

  // Calculate available overflow for panning
  const overflowX = Math.max(0, imgWidth - cropWidth);
  const overflowY = Math.max(0, imgHeight - cropHeight);

  // Apply user's offset (-50 to 50 percent of overflow)
  const offsetX = options.imageOffsetX || 0;
  const offsetY = options.imageOffsetY || 0;

  // Convert offset percentage to pixels
  // Center crop by default, then adjust by offset
  let left = Math.round((imgWidth - cropWidth) / 2 + (offsetX / 100) * overflowX);
  let top = Math.round((imgHeight - cropHeight) / 2 + (offsetY / 100) * overflowY);

  // Clamp to valid range
  left = Math.max(0, Math.min(imgWidth - cropWidth, left));
  top = Math.max(0, Math.min(imgHeight - cropHeight, top));

  return sharp(imageBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Apply overlay and crop to 4:5 aspect ratio in one operation (Instagram portrait)
 * Respects image transform settings (scale/pan) from the editor
 */
export async function processImageForExport(
  imageBuffer: Buffer,
  caption: string,
  options: Partial<OverlayOptions> = {}
): Promise<Buffer> {
  // First apply image transform and crop to 4:5
  const cropped = await applyImageTransformAndCrop(imageBuffer, 4, 5, options);

  // Then apply the caption overlay on the cropped image
  const overlaid = await overlayCaption(cropped, caption, options);

  return overlaid;
}

/**
 * Process image from URL for export (overlay + crop)
 */
export async function processImageFromUrlForExport(
  imageUrl: string,
  caption: string,
  options: Partial<OverlayOptions> = {}
): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  return processImageForExport(imageBuffer, caption, options);
}
