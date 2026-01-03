/**
 * Settings API Route
 * Manages generation settings and API usage stats
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSettings,
  saveSettings,
  getApiUsageStats,
  initializeDataDirectory,
} from '@/lib/storage-service';
import type { GenerationSettings } from '@/types';

/**
 * GET: Retrieve current settings and API usage stats
 */
export async function GET() {
  try {
    await initializeDataDirectory();

    const settings = await getSettings();
    const apiUsage = await getApiUsageStats();

    return NextResponse.json({
      success: true,
      settings,
      apiUsage,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Update settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updates = body as Partial<GenerationSettings>;

    // Validate settings
    const validImageModes = ['ai', 'stock'];
    const validStockSources = ['pexels', 'unsplash', 'both'];
    const validQualities = ['standard', 'hd'];

    if (updates.imageMode && !validImageModes.includes(updates.imageMode)) {
      return NextResponse.json(
        { error: 'Invalid image mode' },
        { status: 400 }
      );
    }

    if (updates.stockSource && !validStockSources.includes(updates.stockSource)) {
      return NextResponse.json(
        { error: 'Invalid stock source' },
        { status: 400 }
      );
    }

    if (updates.imageQuality && !validQualities.includes(updates.imageQuality)) {
      return NextResponse.json(
        { error: 'Invalid image quality' },
        { status: 400 }
      );
    }

    if (
      updates.brandVoiceStrictness !== undefined &&
      (updates.brandVoiceStrictness < 0 || updates.brandVoiceStrictness > 100)
    ) {
      return NextResponse.json(
        { error: 'Brand voice strictness must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Get current settings and merge
    const currentSettings = await getSettings();
    const newSettings: GenerationSettings = {
      ...currentSettings,
      ...updates,
    };

    await saveSettings(newSettings);

    return NextResponse.json({
      success: true,
      settings: newSettings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}
