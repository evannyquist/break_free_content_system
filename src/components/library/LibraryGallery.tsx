/**
 * Library Gallery Component
 * Displays uploaded images with captions for review and editing
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Star,
  Edit3,
  Trash2,
  Check,
  X,
  AlertCircle,
  Eye,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button, Card, Input, Badge, EmptyState, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { LibraryImage } from '@/types';

interface LibraryGalleryProps {
  images?: LibraryImage[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function LibraryGallery({ images = [], isLoading, onRefresh }: LibraryGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'low'>('all');
  const [filterVerification, setFilterVerification] = useState<'all' | 'verified' | 'unverified'>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState<LibraryImage | null>(null);

  // Filter images based on search and filters
  const filteredImages = images.filter((img) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !img.extractedCaption?.toLowerCase().includes(query) &&
        !img.filename?.toLowerCase().includes(query) &&
        !img.analyzedTheme?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Confidence filter
    if (filterConfidence === 'high' && (img.captionConfidence || 0) < 0.8) {
      return false;
    }
    if (filterConfidence === 'low' && (img.captionConfidence || 0) >= 0.8) {
      return false;
    }

    // Favorites filter
    if (filterFavorites && !img.isFavorite) {
      return false;
    }

    // Verification filter
    if (filterVerification === 'verified' && !img.manuallyVerified) {
      return false;
    }
    if (filterVerification === 'unverified' && img.manuallyVerified) {
      return false;
    }

    return true;
  });

  // Calculate verification stats
  const verifiedCount = images.filter((img) => img.manuallyVerified).length;
  const unverifiedCount = images.length - verifiedCount;

  const handleEditCaption = (image: LibraryImage) => {
    setEditingId(image.id);
    setEditingCaption(image.extractedCaption || '');
  };

  const handleSaveCaption = async (id: string) => {
    try {
      await fetch('/api/library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          updates: { extractedCaption: editingCaption },
        }),
      });
      setEditingId(null);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save caption:', error);
    }
  };

  const handleToggleFavorite = async (id: string, currentStatus: boolean) => {
    try {
      await fetch('/api/library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          updates: { isFavorite: !currentStatus },
        }),
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image from the library?')) {
      return;
    }

    try {
      await fetch(`/api/library?id=${id}`, { method: 'DELETE' });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  // Mark image as verified without changing caption
  const handleVerify = async (id: string) => {
    try {
      await fetch('/api/library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          updates: { manuallyVerified: true },
        }),
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to verify image:', error);
    }
  };

  // Navigate to next/previous image in filtered list
  const navigateImage = (direction: 'next' | 'prev') => {
    if (!selectedImage) return;

    const currentIndex = filteredImages.findIndex((img) => img.id === selectedImage.id);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex + 1 >= filteredImages.length ? 0 : currentIndex + 1;
    } else {
      newIndex = currentIndex - 1 < 0 ? filteredImages.length - 1 : currentIndex - 1;
    }

    const newImage = filteredImages[newIndex];
    setSelectedImage(newImage);
    setEditingId(null);

    // Auto-enter edit mode for low confidence unverified images
    if ((newImage.captionConfidence || 0) < 0.8 && !newImage.manuallyVerified) {
      setEditingId(newImage.id);
      setEditingCaption(newImage.extractedCaption || '');
    }
  };

  // Verify current image and move to next
  const handleVerifyAndNext = async () => {
    if (!selectedImage) return;

    if (editingId === selectedImage.id) {
      // Save the edited caption first
      await handleSaveCaption(selectedImage.id);
      setSelectedImage({
        ...selectedImage,
        extractedCaption: editingCaption,
        manuallyVerified: true,
      });
    } else if (!selectedImage.manuallyVerified) {
      // Just verify without editing
      await handleVerify(selectedImage.id);
      setSelectedImage({
        ...selectedImage,
        manuallyVerified: true,
      });
    }

    // Move to next image
    navigateImage('next');
  };

  // Keyboard navigation
  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in textarea
      if (e.target instanceof HTMLTextAreaElement) {
        // Allow Enter to save and advance when in edit mode
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleVerifyAndNext();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigateImage('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateImage('next');
          break;
        case 'Enter':
          e.preventDefault();
          handleVerifyAndNext();
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedImage(null);
          setEditingId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, editingId, editingCaption, filteredImages]);

  // Auto-enter edit mode when opening low confidence image
  useEffect(() => {
    if (selectedImage && (selectedImage.captionConfidence || 0) < 0.8 && !selectedImage.manuallyVerified) {
      setEditingId(selectedImage.id);
      setEditingCaption(selectedImage.extractedCaption || '');
    }
  }, [selectedImage?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <EmptyState
        icon={<Grid className="h-16 w-16" />}
        title="No images in library"
        description="Upload your existing content to start building your brand voice profile"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search captions, themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={filterVerification}
            onChange={(e) => setFilterVerification(e.target.value as 'all' | 'verified' | 'unverified')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
          >
            <option value="all">All Captions</option>
            <option value="verified">Verified</option>
            <option value="unverified">Needs Review</option>
          </select>

          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value as 'all' | 'high' | 'low')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
          >
            <option value="all">All Confidence</option>
            <option value="high">High Confidence</option>
            <option value="low">Low Confidence</option>
          </select>

          <Button
            variant={filterFavorites ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={<Star className={cn('h-4 w-4', filterFavorites && 'fill-current')} />}
            onClick={() => setFilterFavorites(!filterFavorites)}
          >
            Favorites
          </Button>

          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count & Progress */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {filteredImages.length} of {images.length} images
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {verifiedCount} verified
          </Badge>
          {unverifiedCount > 0 && (
            <Badge variant="warning">
              {unverifiedCount} to review
            </Badge>
          )}
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map((image) => (
            <motion.div
              key={image.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card
                variant="bordered"
                padding="none"
                className="group overflow-hidden cursor-pointer hover:border-brand-500/50 transition-colors"
                onClick={() => setSelectedImage(image)}
              >
                {/* Image */}
                <div className="aspect-square bg-slate-800 relative overflow-hidden">
                  <img
                    src={`/api/library/image/${image.id}`}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {image.manuallyVerified && (
                      <Badge size="sm" variant="success">
                        <Check className="h-3 w-3" />
                      </Badge>
                    )}
                    {image.isFavorite && (
                      <Badge size="sm" variant="brand">
                        <Star className="h-3 w-3 fill-current" />
                      </Badge>
                    )}
                    {(image.captionConfidence || 0) < 0.8 && !image.manuallyVerified && (
                      <Badge size="sm" variant="warning">
                        Review
                      </Badge>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(image.id, image.isFavorite);
                      }}
                      className="p-1.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-yellow-400 transition-colors"
                    >
                      <Star
                        className={cn(
                          'h-3.5 w-3.5',
                          image.isFavorite && 'fill-yellow-400 text-yellow-400'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Caption */}
                <div className="p-3">
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {image.extractedCaption || 'No caption extracted'}
                  </p>
                  {image.analyzedTheme && (
                    <Badge size="sm" variant="default" className="mt-2">
                      {image.analyzedTheme}
                    </Badge>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredImages.map((image) => (
            <motion.div
              key={image.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card variant="bordered" className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden">
                  <img
                    src={`/api/library/image/${image.id}`}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Caption */}
                <div className="flex-1 min-w-0">
                  {editingId === image.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingCaption}
                        onChange={(e) => setEditingCaption(e.target.value)}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleSaveCaption(image.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-200 truncate">
                        {image.extractedCaption || 'No caption'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{image.filename}</span>
                        {image.analyzedTheme && (
                          <Badge size="sm">{image.analyzedTheme}</Badge>
                        )}
                        {(image.captionConfidence || 0) < 0.8 && !image.manuallyVerified && (
                          <Badge size="sm" variant="warning">Low confidence</Badge>
                        )}
                        {image.manuallyVerified && (
                          <Badge size="sm" variant="success">Verified</Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== image.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleFavorite(image.id, image.isFavorite)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        image.isFavorite
                          ? 'text-yellow-400'
                          : 'text-slate-500 hover:text-yellow-400'
                      )}
                    >
                      <Star
                        className={cn('h-4 w-4', image.isFavorite && 'fill-current')}
                      />
                    </button>
                    <button
                      onClick={() => handleEditCaption(image)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(image.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Image Detail Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Card variant="elevated" padding="lg" className="relative">
                {/* Navigation Arrows */}
                <button
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors z-10"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors z-10"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {selectedImage.filename}
                      </h3>
                      {selectedImage.manuallyVerified && (
                        <Badge variant="success" size="sm" className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      Uploaded {new Date(selectedImage.uploadedAt).toLocaleDateString()}
                      {' · '}
                      {filteredImages.findIndex((img) => img.id === selectedImage.id) + 1} of {filteredImages.length}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="aspect-video bg-slate-800 rounded-lg mb-4 overflow-hidden">
                  <img
                    src={`/api/library/image/${selectedImage.id}`}
                    alt={selectedImage.filename}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Caption
                    </label>
                    {editingId === selectedImage.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingCaption}
                          onChange={(e) => setEditingCaption(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={async () => {
                              await handleSaveCaption(selectedImage.id);
                              setSelectedImage({
                                ...selectedImage,
                                extractedCaption: editingCaption,
                                manuallyVerified: true,
                              });
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-200">{selectedImage.extractedCaption}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Confidence
                      </label>
                      <Badge
                        variant={
                          (selectedImage.captionConfidence || 0) >= 0.8
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {Math.round((selectedImage.captionConfidence || 0) * 100)}%
                      </Badge>
                    </div>
                    {selectedImage.analyzedTheme && (
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                          Theme
                        </label>
                        <Badge>{selectedImage.analyzedTheme}</Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-600">
                      ← → Navigate · Enter Verify & Next · Esc Close
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={
                          <Star
                            className={cn(
                              'h-4 w-4',
                              selectedImage.isFavorite && 'fill-yellow-400 text-yellow-400'
                            )}
                          />
                        }
                        onClick={() =>
                          handleToggleFavorite(selectedImage.id, selectedImage.isFavorite)
                        }
                      >
                        {selectedImage.isFavorite ? 'Unfavorite' : 'Favorite'}
                      </Button>
                      {editingId !== selectedImage.id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Edit3 className="h-4 w-4" />}
                          onClick={() => handleEditCaption(selectedImage)}
                        >
                          Edit
                        </Button>
                      )}
                      {!selectedImage.manuallyVerified && editingId !== selectedImage.id && (
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Check className="h-4 w-4" />}
                          onClick={() => handleVerifyAndNext()}
                        >
                          Verify & Next
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
