'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ArrowRight,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';
import { ImageTextEditor } from '@/components/editor/ImageTextEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { cn } from '@/lib/utils';
import type { SelectedImage, GeneratedCaption, OverlaySettings, TextColorOption, TextAlignment } from '@/types';

interface CaptionSelectorProps {
  images: SelectedImage[];
  onCaptionSelect: (imageIndex: number, caption: GeneratedCaption) => void;
  onOverlaySettingsChange: (imageIndex: number, settings: OverlaySettings) => void;
  onProceed: () => void;
}

// Default overlay settings for new images
const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  x: 50,           // Center horizontally
  y: 80,           // Near bottom (80% from top)
  fontSize: 34,
  width: 80,       // 80% of canvas width
  textAlign: 'center',
  textColor: 'white',
};

export function CaptionSelector({
  images,
  onCaptionSelect,
  onOverlaySettingsChange,
  onProceed,
}: CaptionSelectorProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [accentColors, setAccentColors] = useState<Record<number, string>>({});
  const [loadingColors, setLoadingColors] = useState<Record<number, boolean>>({});

  const activeImage = images[activeImageIndex];
  const allCaptionsSelected = images.every(img => img.selectedCaption !== null);

  // Ensure overlay settings have proper defaults
  const currentSettings: OverlaySettings = {
    ...DEFAULT_OVERLAY_SETTINGS,
    ...activeImage.overlaySettings,
  };

  // Fetch accent color for active image
  useEffect(() => {
    if (activeImage && !accentColors[activeImageIndex] && !loadingColors[activeImageIndex]) {
      fetchAccentColor(activeImageIndex, activeImage.highResUrl);
    }
  }, [activeImageIndex, activeImage]);

  const fetchAccentColor = async (index: number, imageUrl: string) => {
    setLoadingColors(prev => ({ ...prev, [index]: true }));
    try {
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          getColors: true,
        }),
      });
      const data = await response.json();
      if (data.success && data.colors?.accent) {
        setAccentColors(prev => ({ ...prev, [index]: data.colors.accent }));
      }
    } catch (err) {
      console.error('Failed to fetch accent color:', err);
    } finally {
      setLoadingColors(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleCaptionClick = (caption: GeneratedCaption) => {
    onCaptionSelect(activeImageIndex, caption);
  };

  const handleColorChange = (textColor: TextColorOption) => {
    onOverlaySettingsChange(activeImageIndex, {
      ...currentSettings,
      textColor,
      accentColor: textColor === 'accent' ? accentColors[activeImageIndex] : undefined,
    });
  };

  const handleFontSizeChange = (fontSize: number) => {
    onOverlaySettingsChange(activeImageIndex, {
      ...currentSettings,
      fontSize,
    });
  };

  const handleCanvasSettingsChange = (settings: { x: number; y: number; fontSize: number; width: number }) => {
    onOverlaySettingsChange(activeImageIndex, {
      ...currentSettings,
      x: settings.x,
      y: settings.y,
      fontSize: settings.fontSize,
      width: settings.width,
    });
  };

  const handleAlignmentChange = (textAlign: TextAlignment) => {
    onOverlaySettingsChange(activeImageIndex, {
      ...currentSettings,
      textAlign,
    });
  };

  const handleResetPosition = () => {
    onOverlaySettingsChange(activeImageIndex, {
      ...currentSettings,
      x: DEFAULT_OVERLAY_SETTINGS.x,
      y: DEFAULT_OVERLAY_SETTINGS.y,
      fontSize: DEFAULT_OVERLAY_SETTINGS.fontSize,
      width: DEFAULT_OVERLAY_SETTINGS.width,
      textAlign: DEFAULT_OVERLAY_SETTINGS.textAlign,
      // Reset image transform too
      imageScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
    });
  };

  const handleImageTransformChange = (transform: { imageScale: number; imageOffsetX: number; imageOffsetY: number }) => {
    onOverlaySettingsChange(activeImageIndex, {
      ...currentSettings,
      imageScale: transform.imageScale,
      imageOffsetX: transform.imageOffsetX,
      imageOffsetY: transform.imageOffsetY,
    });
  };

  const goToNextImage = () => {
    if (activeImageIndex < images.length - 1) {
      setActiveImageIndex(prev => prev + 1);
    }
  };

  const goToPrevImage = () => {
    if (activeImageIndex > 0) {
      setActiveImageIndex(prev => prev - 1);
    }
  };

  // Get text color hex value
  const getTextColorHex = (): string => {
    if (currentSettings.textColor === 'accent' && accentColors[activeImageIndex]) {
      return accentColors[activeImageIndex];
    }
    return currentSettings.textColor === 'black' ? '#000000' : '#FFFFFF';
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setActiveImageIndex(index)}
              className={cn(
                'relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all',
                index === activeImageIndex
                  ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : img.selectedCaption
                  ? 'border-emerald-500'
                  : 'border-gray-300 hover:border-gray-400'
              )}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
              />
              {img.selectedCaption && index !== activeImageIndex && (
                <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {images.filter(i => i.selectedCaption).length}/{images.length} selected
          </span>
          {allCaptionsSelected && (
            <Button
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="h-4 w-4" />}
              onClick={onProceed}
            >
              Continue
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Preview with Canvas Editor */}
        <div className="space-y-4">
          {/* Image number badge */}
          <div className="flex items-center justify-between">
            <Badge variant="default" className="bg-gray-100 text-gray-700">
              Image {activeImageIndex + 1} of {images.length}
            </Badge>
          </div>

          {/* Canvas Editor */}
          <ImageTextEditor
            key={activeImageIndex}
            imageUrl={activeImage.highResUrl}
            caption={activeImage.selectedCaption?.text || 'Select a caption below'}
            x={currentSettings.x}
            y={currentSettings.y}
            fontSize={currentSettings.fontSize}
            width={currentSettings.width}
            textAlign={currentSettings.textAlign}
            textColor={getTextColorHex()}
            imageScale={currentSettings.imageScale}
            imageOffsetX={currentSettings.imageOffsetX}
            imageOffsetY={currentSettings.imageOffsetY}
            onSettingsChange={handleCanvasSettingsChange}
            onImageTransformChange={handleImageTransformChange}
          />

          {/* Editor Toolbar */}
          <EditorToolbar
            textColor={currentSettings.textColor}
            fontSize={currentSettings.fontSize}
            textAlign={currentSettings.textAlign}
            accentColor={accentColors[activeImageIndex]}
            isLoadingAccent={loadingColors[activeImageIndex]}
            onColorChange={handleColorChange}
            onFontSizeChange={handleFontSizeChange}
            onAlignmentChange={handleAlignmentChange}
            onResetPosition={handleResetPosition}
          />
        </div>

        {/* Caption Options */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">
            Select a Caption
          </h3>

          <div className="space-y-3">
            {activeImage.captionOptions.map((caption, index) => (
              <motion.button
                key={caption.id}
                onClick={() => handleCaptionClick(caption)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 text-left transition-all',
                  activeImage.selectedCaption?.id === caption.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        size="sm"
                        variant={
                          activeImage.selectedCaption?.id === caption.id ? 'brand' : 'default'
                        }
                      >
                        Option {index + 1}
                      </Badge>
                      <Badge size="sm" variant="info">
                        {caption.category}
                      </Badge>
                      <Badge
                        size="sm"
                        variant={caption.brandVoiceScore >= 70 ? 'success' : 'warning'}
                      >
                        {caption.brandVoiceScore}%
                      </Badge>
                    </div>
                    <p className="text-gray-800 font-medium">
                      {caption.text}
                    </p>
                  </div>

                  {activeImage.selectedCaption?.id === caption.id && (
                    <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevImage}
              disabled={activeImageIndex === 0}
            >
              Previous Image
            </Button>

            {activeImage.selectedCaption && activeImageIndex < images.length - 1 && (
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={goToNextImage}
              >
                Next Image
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary of selections */}
      <Card variant="bordered" className="p-4">
        <h4 className="font-medium text-gray-800 mb-3">Selected Captions</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setActiveImageIndex(index)}
              className={cn(
                'p-2 rounded-lg text-left transition-colors',
                index === activeImageIndex ? 'bg-brand-50' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="aspect-square rounded overflow-hidden mb-2">
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-gray-500 truncate">
                {img.selectedCaption?.text || 'Not selected'}
              </p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
