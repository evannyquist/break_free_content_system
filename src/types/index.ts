// Core content types for the Break Free Content System

export interface LibraryImage {
  id: string;
  filename: string;
  filepath: string;
  contentHash?: string; // MD5 hash for duplicate detection
  extractedCaption: string;
  captionConfidence: number; // 0-1 scale
  manuallyVerified: boolean;
  analyzedTheme?: string;
  analyzedAesthetic?: string[];
  isFavorite: boolean;
  uploadedAt: string;
  base64?: string; // For display purposes
}

export interface CaptionPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  category: CaptionCategory;
}

export type CaptionCategory = 
  | 'post-run'
  | 'during-run'
  | 'gear'
  | 'weather'
  | 'race-day'
  | 'recovery'
  | 'training'
  | 'motivation'
  | 'humor'
  | 'other';

export interface ThemePattern {
  theme: string;
  frequency: number;
  examples: string[];
  aesthetic: string[];
}

export interface BrandVoiceProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  totalCaptionsAnalyzed: number;
  totalImagesAnalyzed: number;
  
  // Caption analysis
  averageCaptionLength: number;
  captionLengthRange: { min: number; max: number };
  commonPhrases: string[];
  jokeStructures: string[];
  toneMarkers: string[];
  captionPatterns: CaptionPattern[];
  captionCategories: Record<CaptionCategory, number>;
  
  // Theme analysis
  commonThemes: ThemePattern[];
  aestheticPreferences: string[];
  colorPalettes: string[];
  compositionStyles: string[];
  
  // Sample captions for few-shot learning
  exampleCaptions: string[];
  favoritesCaptions: string[];
}

export interface GeneratedCaption {
  id: string;
  text: string;
  theme: string;
  brandVoiceScore: number; // 0-100
  category: CaptionCategory;
  regenerationCount: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  localPath?: string;
  source: 'dalle' | 'flux' | 'pexels' | 'unsplash' | 'cosmos' | 'midjourney';
  prompt?: string;
  searchQuery?: string;
  attribution?: string;
  regenerationCount: number;
}

export interface CarouselContent {
  id: string;
  date: string;
  theme: string;
  themeDescription: string;
  imageMode: 'ai' | 'stock';
  items: CarouselItem[];
  status: 'draft' | 'approved' | 'exported';
  createdAt: string;
  updatedAt: string;
  brandVoiceScore: number;
}

export interface CarouselItem {
  index: number;
  caption: GeneratedCaption;
  image: GeneratedImage;
}

export interface WeeklyContent {
  id: string;
  weekStartDate: string;
  carousels: CarouselContent[];
  createdAt: string;
  status: 'generating' | 'draft' | 'approved' | 'exported';
}

export interface GenerationSettings {
  imageMode: 'ai' | 'stock';
  stockSource: 'pexels' | 'unsplash' | 'both';
  brandVoiceStrictness: number; // 0-100
  imageStyle: string;
  imageQuality: 'standard' | 'hd';
  themeCategories: string[];
  excludedThemes: string[];
}

export interface LibraryAnalysisProgress {
  status: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'error';
  totalImages: number;
  processedImages: number;
  currentStep: string;
  errorMessage?: string;
}

export interface ApiUsageStats {
  anthropicCalls: number;
  anthropicTokens: number;
  openaiCalls: number;
  pexelsCalls: number;
  unsplashCalls: number;
  lastUpdated: string;
}

export interface ExportOptions {
  format: 'zip' | 'folder';
  includeMetadata: boolean;
  namingConvention: 'date-index' | 'theme-index' | 'caption-preview';
  captionFormat: 'json' | 'csv' | 'txt';
}

// Weekly Planner Types
export type TextPosition = 'bottom' | 'top' | 'left' | 'right';
export type TextColorOption = 'black' | 'white' | 'accent';
export type TextAlignment = 'left' | 'center' | 'right';

export interface OverlaySettings {
  // Text positioning (percentage-based, 0-100)
  x: number;           // Horizontal position (% from left)
  y: number;           // Vertical position (% from top)
  fontSize: number;    // Font size in pixels (24-96)
  width: number;       // Text box width as % of canvas (20-100)
  textAlign: TextAlignment;
  textColor: TextColorOption;
  accentColor?: string;

  // Image transform settings (for crop/zoom control)
  imageScale?: number;      // Zoom level (1.0 = minimum to cover canvas, higher = more zoomed)
  imageOffsetX?: number;    // Horizontal pan (% of overflow, -50 to 50)
  imageOffsetY?: number;    // Vertical pan (% of overflow, -50 to 50)
}

export interface SelectedImage {
  id: string;
  cosmosId: number;
  url: string;
  highResUrl: string;
  captionOptions: GeneratedCaption[];
  selectedCaption: GeneratedCaption | null;
  overlaySettings: OverlaySettings;
  processedImageBase64?: string;
}

export type DayStatus = 'pending' | 'images-selected' | 'captions-generated' | 'captions-selected' | 'complete';

export interface DayContent {
  date: string;
  dayOfWeek: string;
  images: SelectedImage[];
  status: DayStatus;
}

export type WeekStatus = 'in-progress' | 'complete' | 'exported';

export interface WeekPlan {
  id: string;
  weekStartDate: string;
  days: DayContent[];
  status: WeekStatus;
  createdAt: string;
  updatedAt: string;
}
