/**
 * Generation Panel Component
 * Controls for generating new carousel content
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Zap,
  Settings2,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button, Card, Badge, Switch, Slider, Select, Progress } from '@/components/ui';
import { cn, getWeekDates, formatDate } from '@/lib/utils';
import type { GenerationSettings, BrandVoiceProfile } from '@/types';

interface GenerationPanelProps {
  settings: GenerationSettings;
  profile: BrandVoiceProfile | null;
  onGenerate: (dates: string[], imageMode: 'ai' | 'stock') => void;
  isGenerating: boolean;
  progress?: { current: number; total: number; status: string };
  onUpdateSettings: (updates: Partial<GenerationSettings>) => void;
}

export function GenerationPanel({
  settings,
  profile,
  onGenerate,
  isGenerating,
  progress,
  onUpdateSettings,
}: GenerationPanelProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generationType, setGenerationType] = useState<'week' | 'custom'>('week');

  // Get next week's dates
  const today = new Date();
  const nextWeekStart = new Date(today);
  nextWeekStart.setDate(today.getDate() + ((8 - today.getDay()) % 7));
  const weekDates = getWeekDates(nextWeekStart);

  const handleSelectWeek = () => {
    setGenerationType('week');
    setSelectedDates(weekDates.map((d) => d.toISOString().split('T')[0]));
  };

  const handleSelectToday = () => {
    setGenerationType('custom');
    setSelectedDates([today.toISOString().split('T')[0]]);
  };

  const handleToggleDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDates((prev) =>
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr]
    );
    setGenerationType('custom');
  };

  const handleGenerate = () => {
    if (selectedDates.length === 0) {
      handleSelectWeek();
      return;
    }
    onGenerate(selectedDates, settings.imageMode);
  };

  const hasProfile = profile && profile.totalCaptionsAnalyzed > 0;

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card variant="gradient" padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-brand-100">
            <Sparkles className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Generate Content</h2>
            <p className="text-sm text-gray-500">
              Create carousels for your Instagram feed
            </p>
          </div>
        </div>

        {/* Profile Warning */}
        {!hasProfile && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium">
                  No brand voice profile detected
                </p>
                <p className="text-sm text-amber-600 mt-1">
                  Upload your existing content and run analysis to generate
                  captions that match your brand style.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Select Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            variant={generationType === 'week' ? 'primary' : 'secondary'}
            onClick={handleSelectWeek}
            leftIcon={<Calendar className="h-4 w-4" />}
          >
            Generate Week
          </Button>
          <Button
            variant={
              generationType === 'custom' && selectedDates.length === 1
                ? 'primary'
                : 'secondary'
            }
            onClick={handleSelectToday}
          >
            Today Only
          </Button>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Dates
          </label>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const dateStr = date.toISOString().split('T')[0];
              const isSelected = selectedDates.includes(dateStr);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = date.getDate();

              return (
                <button
                  key={dateStr}
                  onClick={() => handleToggleDate(date)}
                  className={cn(
                    'p-3 rounded-lg border transition-all text-center',
                    isSelected
                      ? 'bg-brand-50 border-brand-500 text-brand-600'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <span className="block text-xs font-medium">{dayName}</span>
                  <span className="block text-lg font-bold mt-1">{dayNum}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Image Mode Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 mb-6">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Image Source</p>
              <p className="text-xs text-gray-500">
                {settings.imageMode === 'ai'
                  ? 'Generate cinematic images with Flux Pro'
                  : 'Use high-quality stock photos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-sm',
                settings.imageMode === 'stock' ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              Stock
            </span>
            <Switch
              checked={settings.imageMode === 'ai'}
              onChange={(checked) =>
                onUpdateSettings({ imageMode: checked ? 'ai' : 'stock' })
              }
            />
            <span
              className={cn(
                'text-sm',
                settings.imageMode === 'ai' ? 'text-brand-600' : 'text-gray-400'
              )}
            >
              AI
            </span>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          isLoading={isGenerating}
          disabled={selectedDates.length === 0}
          leftIcon={<Zap className="h-5 w-5" />}
        >
          {isGenerating
            ? `Generating (${progress?.current || 0}/${progress?.total || selectedDates.length})`
            : `Generate ${selectedDates.length} Carousel${selectedDates.length !== 1 ? 's' : ''}`}
        </Button>

        {/* Progress */}
        {isGenerating && progress && (
          <div className="mt-4">
            <Progress
              value={progress.current}
              max={progress.total}
              size="md"
              variant="brand"
            />
            <p className="text-sm text-gray-500 mt-2 text-center">
              {progress.status}
            </p>
          </div>
        )}
      </Card>

      {/* Advanced Settings */}
      <Card variant="bordered">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-900">Advanced Settings</span>
          </div>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-gray-400 transition-transform',
              showAdvanced && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-6 border-t border-gray-200">
                {/* Brand Voice Strictness */}
                <Slider
                  label="Brand Voice Strictness"
                  value={settings.brandVoiceStrictness}
                  onChange={(value) =>
                    onUpdateSettings({ brandVoiceStrictness: value })
                  }
                  min={0}
                  max={100}
                />
                <p className="text-xs text-gray-500 -mt-3">
                  Higher = closer match to your library style. Lower = more creative
                  variation.
                </p>

                {/* Stock Source */}
                {settings.imageMode === 'stock' && (
                  <Select
                    label="Stock Photo Source"
                    value={settings.stockSource}
                    onChange={(e) =>
                      onUpdateSettings({
                        stockSource: e.target.value as 'pexels' | 'unsplash' | 'both',
                      })
                    }
                    options={[
                      { value: 'both', label: 'Both (Pexels + Unsplash)' },
                      { value: 'pexels', label: 'Pexels Only' },
                      { value: 'unsplash', label: 'Unsplash Only' },
                    ]}
                  />
                )}

                {/* Image Quality */}
                {settings.imageMode === 'ai' && (
                  <Select
                    label="Image Quality"
                    value={settings.imageQuality}
                    onChange={(e) =>
                      onUpdateSettings({
                        imageQuality: e.target.value as 'standard' | 'hd',
                      })
                    }
                    options={[
                      { value: 'standard', label: 'Standard' },
                      { value: 'hd', label: 'HD (Higher cost)' },
                    ]}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Profile Summary */}
      {hasProfile && (
        <Card variant="bordered">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="font-medium text-gray-900">
              Brand Voice Active
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Captions analyzed:</span>
              <span className="text-gray-900 ml-2">
                {profile.totalCaptionsAnalyzed}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Avg. length:</span>
              <span className="text-gray-900 ml-2">
                {profile.averageCaptionLength} chars
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {profile.toneMarkers.slice(0, 5).map((marker) => (
              <Badge key={marker} size="sm" variant="default">
                {marker}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
