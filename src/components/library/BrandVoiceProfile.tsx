/**
 * Brand Voice Profile Component
 * Displays and manages the analyzed brand voice profile
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  MessageSquare,
  Sparkles,
  Palette,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Button, Card, Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { BrandVoiceProfile, CaptionCategory } from '@/types';

interface BrandVoiceProfileProps {
  profile: BrandVoiceProfile | null;
  isAnalyzing?: boolean;
  onAnalyze?: () => void;
}

export function BrandVoiceProfileView({
  profile,
  isAnalyzing,
  onAnalyze,
}: BrandVoiceProfileProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'captions' | 'themes'>('overview');

  if (!profile && !isAnalyzing) {
    return (
      <Card variant="bordered" className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          No Brand Voice Profile
        </h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Analyze your content library to build a brand voice profile that will
          help generate captions matching your style.
        </p>
        <Button onClick={onAnalyze} leftIcon={<Sparkles className="h-4 w-4" />}>
          Analyze Library
        </Button>
      </Card>
    );
  }

  if (isAnalyzing) {
    return (
      <Card variant="bordered" className="text-center py-12">
        <Spinner size="lg" className="mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          Analyzing Your Content
        </h3>
        <p className="text-slate-400 max-w-md mx-auto">
          This may take a few minutes. We're extracting patterns from your
          captions and analyzing image themes...
        </p>
      </Card>
    );
  }

  if (!profile) return null;

  const categoryColors: Record<CaptionCategory, string> = {
    'post-run': 'bg-emerald-500',
    'during-run': 'bg-blue-500',
    gear: 'bg-purple-500',
    weather: 'bg-cyan-500',
    'race-day': 'bg-amber-500',
    recovery: 'bg-pink-500',
    training: 'bg-orange-500',
    motivation: 'bg-green-500',
    humor: 'bg-red-500',
    other: 'bg-slate-500',
  };

  const totalCategories = Object.values(profile.captionCategories).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Brand Voice Profile</h2>
          <p className="text-sm text-slate-400">
            Last updated: {new Date(profile.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={onAnalyze}
        >
          Re-analyze
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg w-fit">
        {(['overview', 'captions', 'themes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card variant="bordered">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Captions Analyzed</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">
                  {profile.totalCaptionsAnalyzed}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-brand-500/20">
                <MessageSquare className="h-5 w-5 text-brand-400" />
              </div>
            </div>
          </Card>

          <Card variant="bordered">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Images Analyzed</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">
                  {profile.totalImagesAnalyzed}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </Card>

          <Card variant="bordered">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg. Caption Length</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">
                  {profile.averageCaptionLength}
                  <span className="text-sm font-normal text-slate-400 ml-1">chars</span>
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/20">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </Card>

          <Card variant="bordered">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">Unique Themes</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">
                  {profile.commonThemes.length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Palette className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="md:col-span-2">
            <h3 className="font-semibold text-slate-200 mb-3">Tone Markers</h3>
            <div className="flex flex-wrap gap-2">
              {profile.toneMarkers.map((marker) => (
                <Badge key={marker} variant="brand">{marker}</Badge>
              ))}
            </div>
          </Card>

          <Card variant="bordered" className="md:col-span-2">
            <h3 className="font-semibold text-slate-200 mb-3">Aesthetic Preferences</h3>
            <div className="flex flex-wrap gap-2">
              {profile.aestheticPreferences.map((pref) => (
                <Badge key={pref} variant="info">{pref}</Badge>
              ))}
            </div>
          </Card>

          <Card variant="bordered" className="md:col-span-2 lg:col-span-4">
            <h3 className="font-semibold text-slate-200 mb-4">Caption Categories</h3>
            <div className="space-y-3">
              {Object.entries(profile.captionCategories)
                .filter(([_, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-24 capitalize">
                      {category.replace('-', ' ')}
                    </span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / totalCategories) * 100}%` }}
                        className={cn('h-full rounded-full', categoryColors[category as CaptionCategory])}
                      />
                    </div>
                    <span className="text-sm text-slate-300 w-12 text-right">{count}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* Captions Tab */}
      {activeTab === 'captions' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card variant="bordered">
            <h3 className="font-semibold text-slate-200 mb-4">Common Phrases</h3>
            <div className="space-y-2">
              {profile.commonPhrases.map((phrase, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-brand-400">•</span>
                  "{phrase}"
                </div>
              ))}
            </div>
          </Card>

          <Card variant="bordered">
            <h3 className="font-semibold text-slate-200 mb-4">Joke Structures</h3>
            <div className="space-y-2">
              {profile.jokeStructures.map((structure, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-emerald-400">•</span>
                  {structure}
                </div>
              ))}
            </div>
          </Card>

          <Card variant="bordered" className="md:col-span-2">
            <h3 className="font-semibold text-slate-200 mb-4">Example Captions</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {profile.exampleCaptions.slice(0, 10).map((caption, idx) => (
                <div key={idx} className="p-3 bg-slate-800/50 rounded-lg text-sm text-slate-300">
                  "{caption}"
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Themes Tab */}
      {activeTab === 'themes' && (
        <div className="space-y-6">
          <Card variant="bordered">
            <h3 className="font-semibold text-slate-200 mb-4">Popular Themes</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profile.commonThemes.map((theme, idx) => (
                <div key={idx} className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-200 capitalize">{theme.theme}</span>
                    <Badge size="sm">{theme.frequency}x</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {theme.aesthetic.slice(0, 3).map((aesthetic) => (
                      <span key={aesthetic} className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                        {aesthetic}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="bordered">
            <h3 className="font-semibold text-slate-200 mb-4">Caption Length Analysis</h3>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-100">{profile.captionLengthRange.min}</p>
                <p className="text-sm text-slate-500">Shortest</p>
              </div>
              <div className="flex-1 mx-8">
                <div className="h-2 bg-slate-800 rounded-full relative">
                  <div
                    className="absolute h-4 w-1 bg-brand-500 rounded-full top-1/2 -translate-y-1/2"
                    style={{
                      left: `${((profile.averageCaptionLength - profile.captionLengthRange.min) /
                        (profile.captionLengthRange.max - profile.captionLengthRange.min)) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-center mt-2 text-sm text-slate-400">
                  Average: {profile.averageCaptionLength} characters
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-100">{profile.captionLengthRange.max}</p>
                <p className="text-sm text-slate-500">Longest</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
