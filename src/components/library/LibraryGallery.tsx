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

    return true;
  });

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

      {/* Results Count */}
      <p className="text-sm text-slate-500">
        Showing {filteredImages.length} of {images.length} images
      </p>

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
                <div className="aspect-square bg-slate-800 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-slate-600 text-xs">Image</span>
                  </div>

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
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
                <div className="w-16 h-16 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center">
                  <span className="text-slate-600 text-xs">IMG</span>
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
              <Card variant="elevated" padding="lg">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">
                      {selectedImage.filename}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Uploaded {new Date(selectedImage.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="aspect-video bg-slate-800 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-slate-500">Image Preview</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Extracted Caption
                    </label>
                    <p className="text-slate-200">{selectedImage.extractedCaption}</p>
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

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                    <Button
                      variant="ghost"
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
                    <Button
                      variant="secondary"
                      leftIcon={<Edit3 className="h-4 w-4" />}
                      onClick={() => {
                        handleEditCaption(selectedImage);
                        setSelectedImage(null);
                      }}
                    >
                      Edit Caption
                    </Button>
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
