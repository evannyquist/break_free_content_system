'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Check,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';
import CosmosBrowser from '@/components/cosmos/CosmosBrowser';
import { CaptionSelector } from './CaptionSelector';
import { cn } from '@/lib/utils';
import type { DayContent, SelectedImage, GeneratedCaption, OverlaySettings } from '@/types';

interface DayPlannerProps {
  day: DayContent;
  dayIndex: number;
  onUpdate: (updatedDay: DayContent) => void;
  onBack: () => void;
}

type DayViewMode = 'browse' | 'generate' | 'select' | 'finalize';

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function DayPlanner({ day, dayIndex, onUpdate, onBack }: DayPlannerProps) {
  const [viewMode, setViewMode] = useState<DayViewMode>(() => {
    if (day.status === 'complete' || day.status === 'captions-selected') return 'finalize';
    if (day.status === 'captions-generated') return 'select';
    if (day.status === 'images-selected') return 'generate';
    return 'browse';
  });
  const [selectedCosmosImages, setSelectedCosmosImages] = useState<Array<{
    cosmosId: number;
    url: string;
    highResUrl: string;
  }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImagesSelected = useCallback((images: Array<{
    cosmosId: number;
    url: string;
    highResUrl: string;
  }>) => {
    setSelectedCosmosImages(images);
  }, []);

  const handleGenerateCaptions = async () => {
    if (selectedCosmosImages.length < 6) {
      setError('Please select at least 6 images');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate/from-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: selectedCosmosImages.map(img => img.highResUrl),
          captionCount: 3,
          saveAsCarousel: false,
        }),
      });

      const data = await response.json();

      if (data.success && data.results) {
        const images: SelectedImage[] = selectedCosmosImages.map((cosmosImg, index) => {
          const result = data.results[index];
          return {
            id: generateId(),
            cosmosId: cosmosImg.cosmosId,
            url: cosmosImg.url,
            highResUrl: cosmosImg.highResUrl,
            captionOptions: result.captionOptions || [result.caption],
            selectedCaption: null,
            overlaySettings: {
              x: 50,
              y: 80,
              fontSize: 34,
              width: 80,
              textAlign: 'center',
              textColor: 'white',
              // Default image transform (centered, no zoom)
              imageScale: 1,
              imageOffsetX: 0,
              imageOffsetY: 0,
            },
          };
        });

        onUpdate({
          ...day,
          images,
          status: 'captions-generated',
        });

        setViewMode('select');
      } else {
        setError(data.error || 'Failed to generate captions');
      }
    } catch (err) {
      setError('Failed to generate captions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCaptionSelect = (imageIndex: number, caption: GeneratedCaption) => {
    const updatedImages = [...day.images];
    updatedImages[imageIndex] = {
      ...updatedImages[imageIndex],
      selectedCaption: caption,
    };

    const allSelected = updatedImages.every(img => img.selectedCaption !== null);

    onUpdate({
      ...day,
      images: updatedImages,
      status: allSelected ? 'captions-selected' : 'captions-generated',
    });
  };

  const handleOverlaySettingsChange = (imageIndex: number, settings: OverlaySettings) => {
    const updatedImages = [...day.images];
    updatedImages[imageIndex] = {
      ...updatedImages[imageIndex],
      overlaySettings: settings,
    };

    onUpdate({
      ...day,
      images: updatedImages,
    });
  };

  const handleFinalize = async () => {
    // Mark as complete
    onUpdate({
      ...day,
      status: 'complete',
    });
    onBack();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {formatDate(day.date)}
            </h2>
            <p className="text-sm text-gray-500">
              {day.images.length > 0
                ? `${day.images.length} images · ${day.images.filter(i => i.selectedCaption).length} captions selected`
                : 'Select 6 images from Cosmos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant={
              day.status === 'complete' ? 'success' :
              day.status === 'captions-selected' ? 'brand' :
              day.status === 'captions-generated' ? 'warning' :
              day.status === 'images-selected' ? 'info' : 'default'
            }
          >
            {day.status.replace('-', ' ')}
          </Badge>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['browse', 'generate', 'select', 'finalize'].map((step, index) => {
          const steps = ['browse', 'generate', 'select', 'finalize'];
          const currentIndex = steps.indexOf(viewMode);
          const isComplete = index < currentIndex;
          const isCurrent = step === viewMode;

          return (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isComplete ? 'bg-emerald-500 text-white' :
                  isCurrent ? 'bg-brand-500 text-white' :
                  'bg-gray-200 text-gray-500'
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < 3 && (
                <div
                  className={cn(
                    'w-12 h-1 mx-1',
                    isComplete ? 'bg-emerald-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content based on view mode */}
      <AnimatePresence mode="wait">
        {/* Browse Mode - Select images from Cosmos */}
        {viewMode === 'browse' && (
          <motion.div
            key="browse"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-500">
                  Browse Cosmos and select exactly 6 images for this day
                </p>
                {selectedCosmosImages.length >= 6 && (
                  <Button
                    variant="primary"
                    leftIcon={<Sparkles className="h-4 w-4" />}
                    onClick={handleGenerateCaptions}
                    isLoading={isGenerating}
                  >
                    Generate Captions ({selectedCosmosImages.length} images)
                  </Button>
                )}
              </div>

              <CosmosBrowserForSelection
                selectedImages={selectedCosmosImages}
                onSelectionChange={handleImagesSelected}
                maxImages={6}
              />
            </div>
          </motion.div>
        )}

        {/* Generate Mode - Waiting for captions */}
        {viewMode === 'generate' && (
          <motion.div
            key="generate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <RefreshCw className="h-12 w-12 text-brand-500 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-800">
              Generating Captions...
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              Analyzing {day.images.length} images and creating caption options
            </p>
          </motion.div>
        )}

        {/* Select Mode - Choose captions */}
        {viewMode === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CaptionSelector
              images={day.images}
              onCaptionSelect={handleCaptionSelect}
              onOverlaySettingsChange={handleOverlaySettingsChange}
              onProceed={() => setViewMode('finalize')}
            />
          </motion.div>
        )}

        {/* Finalize Mode - Review and complete */}
        {viewMode === 'finalize' && (
          <motion.div
            key="finalize"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Final Review
              </h3>
              {day.status !== 'complete' && (
                <Button
                  variant="primary"
                  leftIcon={<Check className="h-4 w-4" />}
                  onClick={handleFinalize}
                >
                  Mark Complete
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {day.images.map((image, index) => (
                <Card key={image.id} variant="bordered" padding="none" className="overflow-hidden">
                  <div className="aspect-[4/5] relative bg-gray-100">
                    <img
                      src={image.url}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {image.selectedCaption && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-white text-sm font-medium">
                            {image.selectedCaption.text}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge variant="default" size="sm">
                        {index + 1}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge size="sm" variant="info">
                        {Math.round(image.overlaySettings.x ?? 50)}%, {Math.round(image.overlaySettings.y ?? 80)}%
                      </Badge>
                      <Badge size="sm" variant="default">
                        {image.overlaySettings.textColor}
                      </Badge>
                    </div>
                    {image.selectedCaption && (
                      <div className="flex items-center gap-2">
                        <Badge
                          size="sm"
                          variant={image.selectedCaption.brandVoiceScore >= 70 ? 'success' : 'warning'}
                        >
                          {image.selectedCaption.brandVoiceScore}%
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {image.selectedCaption.category}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {day.status === 'complete' && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Day Complete</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Modified CosmosBrowser for selection mode
interface CosmosBrowserForSelectionProps {
  selectedImages: Array<{
    cosmosId: number;
    url: string;
    highResUrl: string;
  }>;
  onSelectionChange: (images: Array<{
    cosmosId: number;
    url: string;
    highResUrl: string;
  }>) => void;
  maxImages: number;
}

function CosmosBrowserForSelection({
  selectedImages,
  onSelectionChange,
  maxImages,
}: CosmosBrowserForSelectionProps) {
  // Use the existing CosmosBrowser but track selections externally
  // For now, we'll use a simplified inline browser

  const [categories, setCategories] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [clusters, setClusters] = useState<Array<{
    id: number;
    name: string;
    slug: string;
    ownerUsername: string;
    coverImageUrl: string;
    numberOfElements: number;
  }>>([]);
  const [images, setImages] = useState<Array<{
    cosmosId: number;
    url: string;
    highResUrl: string;
  }>>([]);
  const [view, setView] = useState<'categories' | 'clusters' | 'images'>('categories');
  const [loading, setLoading] = useState(false);
  const [currentCluster, setCurrentCluster] = useState<{ ownerUsername: string; slug: string } | null>(null);

  // Load categories on mount
  useState(() => {
    loadCategories();
  });

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await fetch('/api/cosmos?action=categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadClusters(categorySlug?: string) {
    setLoading(true);
    try {
      const url = categorySlug
        ? `/api/cosmos?action=clusters&categorySlug=${categorySlug}`
        : '/api/cosmos?action=clusters';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setClusters(data.clusters || []);
        setView('clusters');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadImages(username: string, clusterSlug: string) {
    setLoading(true);
    setCurrentCluster({ ownerUsername: username, slug: clusterSlug });
    try {
      const res = await fetch(
        `/api/cosmos?action=elements&username=${username}&clusterSlug=${clusterSlug}&limit=50`
      );
      const data = await res.json();
      if (data.success) {
        setImages(data.images || []);
        setView('images');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(image: { cosmosId: number; url: string; highResUrl: string }) {
    const exists = selectedImages.find(i => i.cosmosId === image.cosmosId);
    if (exists) {
      onSelectionChange(selectedImages.filter(i => i.cosmosId !== image.cosmosId));
    } else if (selectedImages.length < maxImages) {
      onSelectionChange([...selectedImages, image]);
    }
  }

  function isSelected(cosmosId: number) {
    return selectedImages.some(i => i.cosmosId === cosmosId);
  }

  function goBack() {
    if (view === 'images') {
      setView('clusters');
      setCurrentCluster(null);
    } else if (view === 'clusters') {
      setView('categories');
    }
  }

  return (
    <Card variant="bordered" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'categories' && (
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <span className="font-medium text-gray-800">
            {view === 'categories' && 'Browse Categories'}
            {view === 'clusters' && 'Select Collection'}
            {view === 'images' && 'Select Images'}
          </span>
        </div>
        <Badge variant="brand">
          {selectedImages.length}/{maxImages} selected
        </Badge>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <>
            {/* Categories */}
            {view === 'categories' && (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                <button
                  onClick={() => loadClusters()}
                  className="p-3 rounded-lg bg-brand-50 border border-brand-200 hover:bg-brand-100 text-center"
                >
                  <span className="text-sm font-medium text-brand-600">Featured</span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => loadClusters(cat.slug)}
                    className="p-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-center"
                  >
                    <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Clusters */}
            {view === 'clusters' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {clusters.map(cluster => (
                  <button
                    key={cluster.id}
                    onClick={() => loadImages(cluster.ownerUsername, cluster.slug)}
                    className="rounded-lg overflow-hidden bg-gray-50 hover:bg-gray-100 text-left border border-gray-200"
                  >
                    <div className="aspect-square relative">
                      <img
                        src={cluster.coverImageUrl}
                        alt={cluster.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{cluster.name}</p>
                      <p className="text-xs text-gray-500">{cluster.numberOfElements} images</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Images */}
            {view === 'images' && (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {images.map(image => (
                  <button
                    key={image.cosmosId}
                    onClick={() => toggleSelection(image)}
                    className={cn(
                      'relative aspect-square rounded-lg overflow-hidden transition-all',
                      isSelected(image.cosmosId)
                        ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white'
                        : 'hover:opacity-80'
                    )}
                  >
                    <img
                      src={image.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {isSelected(image.cosmosId) && (
                      <div className="absolute inset-0 bg-brand-500/30 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Selected preview */}
      {selectedImages.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {selectedImages.map((img, index) => (
              <div
                key={img.cosmosId}
                className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden"
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white">
                  {index + 1}
                </div>
                <button
                  onClick={() => toggleSelection(img)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
                >
                  <span className="text-white text-xs">×</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
