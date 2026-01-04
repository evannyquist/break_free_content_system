/**
 * Carousel Preview Component
 * Displays a generated carousel with images and captions
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Check,
  Edit3,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  Calendar,
  Palette,
} from 'lucide-react';
import { Button, Card, Badge, Textarea, Progress } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import type { CarouselContent, CarouselItem } from '@/types';

interface CarouselPreviewProps {
  carousel: CarouselContent;
  onRegenerateCaption?: (itemIndex: number) => void;
  onRegenerateImage?: (itemIndex: number) => void;
  onUpdateCaption?: (itemIndex: number, newCaption: string) => void;
  onApprove?: () => void;
  onExport?: () => void;
  isRegenerating?: boolean;
  regeneratingIndex?: number;
}

export function CarouselPreview({
  carousel,
  onRegenerateCaption,
  onRegenerateImage,
  onUpdateCaption,
  onApprove,
  onExport,
  isRegenerating,
  regeneratingIndex,
}: CarouselPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');

  const activeItem = carousel.items[activeIndex];

  const handleEditCaption = (index: number) => {
    setEditingCaption(index);
    setEditedText(carousel.items[index].caption.text);
  };

  const handleSaveCaption = () => {
    if (editingCaption !== null) {
      onUpdateCaption?.(editingCaption, editedText);
      setEditingCaption(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCaption(null);
    setEditedText('');
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev + 1) % carousel.items.length);
  };

  const goToPrevious = () => {
    setActiveIndex((prev) =>
      prev === 0 ? carousel.items.length - 1 : prev - 1
    );
  };

  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">
                {formatDate(carousel.date)}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {carousel.theme}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {carousel.themeDescription}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={carousel.imageMode === 'ai' ? 'brand' : 'info'}
              size="sm"
            >
              {carousel.imageMode === 'ai' ? 'AI Generated' : 'Stock Photos'}
            </Badge>
            <Badge
              variant={
                carousel.brandVoiceScore >= 80
                  ? 'success'
                  : carousel.brandVoiceScore >= 60
                  ? 'warning'
                  : 'error'
              }
              size="sm"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {carousel.brandVoiceScore}% Match
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Preview */}
      <div className="relative aspect-square bg-gray-100">
        {/* Image */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0"
          >
            {activeItem.image.url ? (
              <img
                src={activeItem.image.url}
                alt={`Slide ${activeIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <ImageIcon className="h-16 w-16 text-gray-400" />
              </div>
            )}

            {/* Caption Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {editingCaption === activeIndex ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="bg-white/90 backdrop-blur text-gray-900"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveCaption}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xl text-white font-medium leading-relaxed">
                  {activeItem.caption.text}
                </p>
              )}
            </div>

            {/* Regenerating Overlay */}
            {isRegenerating && regeneratingIndex === activeIndex && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 text-brand-500 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Regenerating...</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 text-gray-700 hover:bg-white transition-colors shadow-sm"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 text-gray-700 hover:bg-white transition-colors shadow-sm"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 mb-20">
          {carousel.items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                idx === activeIndex
                  ? 'bg-white w-6'
                  : 'bg-white/40 hover:bg-white/60'
              )}
            />
          ))}
        </div>
      </div>

      {/* Item Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Slide {activeIndex + 1} of {carousel.items.length}
            </span>
            <Badge size="sm" variant="default">
              {activeItem.caption.category}
            </Badge>
            <Badge
              size="sm"
              variant={activeItem.caption.brandVoiceScore >= 70 ? 'success' : 'warning'}
            >
              {activeItem.caption.brandVoiceScore}% match
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Edit3 className="h-4 w-4" />}
            onClick={() => handleEditCaption(activeIndex)}
            disabled={editingCaption !== null}
          >
            Edit Caption
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<MessageSquare className="h-4 w-4" />}
            onClick={() => onRegenerateCaption?.(activeIndex)}
            isLoading={isRegenerating && regeneratingIndex === activeIndex}
          >
            New Caption
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ImageIcon className="h-4 w-4" />}
            onClick={() => onRegenerateImage?.(activeIndex)}
            isLoading={isRegenerating && regeneratingIndex === activeIndex}
          >
            New Image
          </Button>
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {carousel.items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                idx === activeIndex
                  ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : 'border-transparent hover:border-gray-300'
              )}
            >
              {item.image.url ? (
                <img
                  src={item.image.url}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-500">{idx + 1}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {carousel.status === 'approved' ? (
            <span className="flex items-center gap-1 text-emerald-600">
              <Check className="h-4 w-4" />
              Approved
            </span>
          ) : (
            'Draft'
          )}
        </div>
        <div className="flex gap-2">
          {carousel.status !== 'approved' && (
            <Button
              variant="secondary"
              leftIcon={<Check className="h-4 w-4" />}
              onClick={onApprove}
            >
              Approve
            </Button>
          )}
          <Button
            variant="primary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={onExport}
          >
            Export
          </Button>
        </div>
      </div>
    </Card>
  );
}
