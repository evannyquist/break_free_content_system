'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CosmosCategory {
  id: number;
  name: string;
  slug: string;
}

interface CosmosCluster {
  id: number;
  name: string;
  slug: string;
  ownerUsername: string;
  coverImageUrl: string;
  numberOfElements: number;
  followersCount: number;
}

interface CosmosElement {
  id: number;
  type: string;
  url: string;
  imageUrl: string;
  width: number;
  height: number;
  computerVisionTags: string[];
  generatedCaption?: string;
}

interface CosmosImage {
  id: string;
  cosmosId: number;
  url: string;
  highResUrl: string;
  width: number;
  height: number;
  tags: string[];
  caption?: string;
}

interface GeneratedResult {
  imageUrl: string;
  caption: {
    id: string;
    text: string;
    category: string;
    emotion: string;
    brandVoiceScore: number;
  };
}

type ViewMode = 'categories' | 'clusters' | 'elements' | 'selected' | 'results';

interface CosmosBrowserProps {
  onCarouselCreated?: (carouselId: string) => void;
}

export default function CosmosBrowser({ onCarouselCreated }: CosmosBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [categories, setCategories] = useState<CosmosCategory[]>([]);
  const [clusters, setClusters] = useState<CosmosCluster[]>([]);
  const [elements, setElements] = useState<CosmosElement[]>([]);
  const [images, setImages] = useState<CosmosImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<CosmosImage[]>([]);
  const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);

  const [currentCategory, setCurrentCategory] = useState<CosmosCategory | null>(null);
  const [currentCluster, setCurrentCluster] = useState<CosmosCluster | null>(null);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cosmos?action=categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories);
      } else {
        setError(data.error || 'Failed to load categories');
      }
    } catch (err) {
      setError('Failed to connect to cosmos');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async (categorySlug?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = categorySlug
        ? `/api/cosmos?action=clusters&categorySlug=${categorySlug}`
        : '/api/cosmos?action=clusters';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setClusters(data.clusters);
        setViewMode('clusters');
      } else {
        setError(data.error || 'Failed to load clusters');
      }
    } catch (err) {
      setError('Failed to load clusters');
    } finally {
      setLoading(false);
    }
  };

  const loadElements = async (username: string, clusterSlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cosmos?action=elements&username=${username}&clusterSlug=${clusterSlug}&limit=50`
      );
      const data = await res.json();
      if (data.success) {
        setElements(data.elements);
        setImages(data.images);
        setViewMode('elements');
      } else {
        setError(data.error || 'Failed to load images');
      }
    } catch (err) {
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category: CosmosCategory) => {
    setCurrentCategory(category);
    loadClusters(category.slug);
  };

  const handleClusterClick = (cluster: CosmosCluster) => {
    setCurrentCluster(cluster);
    loadElements(cluster.ownerUsername, cluster.slug);
  };

  const toggleImageSelection = (image: CosmosImage) => {
    setSelectedImages(prev => {
      const exists = prev.find(img => img.cosmosId === image.cosmosId);
      if (exists) {
        return prev.filter(img => img.cosmosId !== image.cosmosId);
      }
      if (prev.length >= 10) {
        return prev; // Max 10 images
      }
      return [...prev, image];
    });
  };

  const isSelected = (image: CosmosImage) => {
    return selectedImages.some(img => img.cosmosId === image.cosmosId);
  };

  const generateCaptions = async () => {
    if (selectedImages.length === 0) return;

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate/from-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: selectedImages.map(img => img.highResUrl),
          sourceCluster: currentCluster
            ? `cosmos.so/${currentCluster.ownerUsername}/${currentCluster.slug}`
            : undefined,
          saveAsCarousel: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedResults(data.results);
        setViewMode('results');
        if (data.carousel?.id && onCarouselCreated) {
          onCarouselCreated(data.carousel.id);
        }
      } else {
        setError(data.error || 'Failed to generate captions');
      }
    } catch (err) {
      setError('Failed to generate captions');
    } finally {
      setGenerating(false);
    }
  };

  const goBack = () => {
    if (viewMode === 'results') {
      setViewMode('selected');
    } else if (viewMode === 'selected') {
      setViewMode('elements');
    } else if (viewMode === 'elements') {
      setViewMode('clusters');
      setCurrentCluster(null);
    } else if (viewMode === 'clusters') {
      setViewMode('categories');
      setCurrentCategory(null);
    }
  };

  const resetSelection = () => {
    setSelectedImages([]);
    setGeneratedResults([]);
    setViewMode('elements');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {viewMode !== 'categories' && (
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="font-semibold text-gray-800">
              {viewMode === 'categories' && 'Browse Cosmos'}
              {viewMode === 'clusters' && (currentCategory?.name || 'Featured Collections')}
              {viewMode === 'elements' && currentCluster?.name}
              {viewMode === 'selected' && `Selected Images (${selectedImages.length})`}
              {viewMode === 'results' && 'Generated Captions'}
            </h2>
            {currentCluster && viewMode === 'elements' && (
              <p className="text-sm text-gray-500">
                by @{currentCluster.ownerUsername} · {currentCluster.numberOfElements} images
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedImages.length > 0 && viewMode !== 'results' && (
            <>
              <button
                onClick={() => setViewMode('selected')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                View Selected ({selectedImages.length})
              </button>
              <button
                onClick={generateCaptions}
                disabled={generating || selectedImages.length < 1}
                className={cn(
                  'px-4 py-1.5 text-sm rounded-lg font-medium transition-colors',
                  generating
                    ? 'bg-gray-200 text-gray-400 cursor-wait'
                    : 'bg-brand-500 hover:bg-brand-600 text-white'
                )}
              >
                {generating ? 'Generating...' : 'Generate Captions'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="p-4">
          {/* Categories Grid */}
          {viewMode === 'categories' && (
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              <button
                onClick={() => loadClusters()}
                className="p-4 rounded-lg bg-brand-50 border border-brand-200 hover:bg-brand-100 transition-colors text-center"
              >
                <span className="text-sm font-medium text-brand-600">Featured</span>
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="p-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-center"
                >
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Clusters Grid */}
          {viewMode === 'clusters' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {clusters.map(cluster => (
                <button
                  key={cluster.id}
                  onClick={() => handleClusterClick(cluster)}
                  className="group rounded-lg overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors text-left border border-gray-200"
                >
                  <div className="aspect-square relative">
                    <Image
                      src={cluster.coverImageUrl}
                      alt={cluster.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-800 truncate">{cluster.name}</p>
                    <p className="text-xs text-gray-500">
                      @{cluster.ownerUsername} · {cluster.numberOfElements} images
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Elements Grid */}
          {viewMode === 'elements' && (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {images.map(image => (
                <button
                  key={image.cosmosId}
                  onClick={() => toggleImageSelection(image)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden transition-all',
                    isSelected(image)
                      ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white'
                      : 'hover:opacity-80'
                  )}
                >
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 20vw"
                  />
                  {isSelected(image) && (
                    <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Selected Images */}
          {viewMode === 'selected' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {selectedImages.map((image, index) => (
                  <div key={image.cosmosId} className="relative aspect-square rounded-lg overflow-hidden">
                    <Image
                      src={image.url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, 16vw"
                    />
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white">
                      {index + 1}
                    </div>
                    <button
                      onClick={() => toggleImageSelection(image)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {selectedImages.length < 6 && (
                <p className="text-center text-gray-500 text-sm">
                  Select at least 6 images for a full carousel ({selectedImages.length}/6 minimum)
                </p>
              )}
            </div>
          )}

          {/* Generated Results */}
          {viewMode === 'results' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedResults.map((result, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    <div className="aspect-square relative">
                      <Image
                        src={result.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3">
                        <p className="text-white text-sm">{result.caption.text}</p>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                          {result.caption.category}
                        </span>
                        <span className="text-xs text-gray-500">
                          Score: {result.caption.brandVoiceScore}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Emotion: {result.caption.emotion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={resetSelection}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
