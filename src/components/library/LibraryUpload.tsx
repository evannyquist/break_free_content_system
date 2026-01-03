/**
 * Library Upload Component
 * Handles bulk image uploads with drag-and-drop support
 * and automatic caption extraction progress display
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Image as ImageIcon,
  X,
  Check,
  AlertCircle,
  Loader2,
  FileImage,
} from 'lucide-react';
import { Button, Card, Progress, Badge } from '@/components/ui';
import { useLibraryStore } from '@/store';
import { cn } from '@/lib/utils';

// Maximum file size in bytes (4.5MB to be safe under 5MB limit)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Target size for compression
const TARGET_FILE_SIZE = 4 * 1024 * 1024;

/**
 * Compress an image file to be under the target size
 * Uses canvas to resize and reduce quality as needed
 */
async function compressImage(file: File): Promise<File> {
  // If already under limit, return as-is
  if (file.size <= MAX_FILE_SIZE) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = async () => {
      // Calculate how much we need to reduce
      const sizeRatio = TARGET_FILE_SIZE / file.size;
      
      // Start with reducing dimensions (more effective than quality for large files)
      // Scale factor: if file is 2x too big, reduce dimensions by ~0.7 (sqrt of 0.5)
      let scale = Math.min(1, Math.sqrt(sizeRatio) * 1.1); // slightly generous
      
      // Ensure minimum dimensions
      const maxDimension = 2048; // Instagram max is ~2048
      const currentMax = Math.max(img.width, img.height);
      if (currentMax * scale > maxDimension) {
        scale = maxDimension / currentMax;
      }
      
      // Set canvas dimensions
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      // Draw image
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Try different quality levels until under limit
      const qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
      
      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>((res) => {
          canvas.toBlob(res, 'image/jpeg', quality);
        });

        if (blob && blob.size <= MAX_FILE_SIZE) {
          // Success! Create a new File object
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          console.log(`Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (quality: ${quality}, scale: ${scale.toFixed(2)})`);
          resolve(compressedFile);
          return;
        }
      }

      // If still too large, try more aggressive scaling
      const smallerScale = scale * 0.7;
      canvas.width = Math.round(img.width * smallerScale);
      canvas.height = Math.round(img.height * smallerScale);
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      const finalBlob = await new Promise<Blob | null>((res) => {
        canvas.toBlob(res, 'image/jpeg', 0.7);
      });

      if (finalBlob) {
        const compressedFile = new File([finalBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        console.log(`Aggressively compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(compressedFile);
      } else {
        reject(new Error('Failed to compress image'));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

interface UploadedFile {
  file: File;
  originalSize?: number;
  compressed?: boolean;
  preview: string;
  status: 'pending' | 'compressing' | 'uploading' | 'processing' | 'complete' | 'error';
  extractedCaption?: string;
  confidence?: number;
  error?: string;
}

export function LibraryUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const { setProgress, addImages } = useLibraryStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setProgress({
      status: 'uploading',
      totalImages: files.length,
      processedImages: 0,
      currentStep: 'Preparing images...',
    });

    const results: UploadedFile[] = [...files];

    // Step 1: Compress any oversized images
    setProgress({
      currentStep: 'Compressing large images...',
    });

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      
      if (item.file.size > MAX_FILE_SIZE) {
        results[i] = { ...results[i], status: 'compressing' };
        setFiles([...results]);
        
        try {
          const compressedFile = await compressImage(item.file);
          results[i] = {
            ...results[i],
            file: compressedFile,
            originalSize: item.file.size,
            compressed: true,
            status: 'pending',
          };
        } catch (error) {
          results[i] = {
            ...results[i],
            status: 'error',
            error: 'Failed to compress image',
          };
        }
        setFiles([...results]);
      }
    }

    // Step 2: Upload in batches
    setProgress({
      currentStep: 'Uploading images...',
    });

    const batchSize = 5;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize).filter(f => f.status !== 'error');
      
      if (batch.length === 0) continue;
      
      const formData = new FormData();

      batch.forEach((item) => {
        formData.append('images', item.file);
        const idx = results.findIndex(r => r.file.name === item.file.name && r.status !== 'error');
        if (idx >= 0) {
          results[idx] = { ...results[idx], status: 'uploading' };
        }
      });

      setFiles([...results]);

      try {
        const response = await fetch('/api/library/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          // Update file statuses with results
          let resultIdx = 0;
          for (const item of batch) {
            const globalIdx = results.findIndex(r => r.file.name === item.file.name && r.status === 'uploading');
            const imageResult = data.images[resultIdx];
            
            if (globalIdx >= 0 && imageResult) {
              results[globalIdx] = {
                ...results[globalIdx],
                status: 'complete',
                extractedCaption: imageResult.extractedCaption,
                confidence: imageResult.captionConfidence,
              };
            }
            resultIdx++;
          }

          // Handle errors
          data.errors?.forEach((error: { filename: string; error: string }) => {
            const idx = results.findIndex((f) => f.file.name === error.filename);
            if (idx >= 0) {
              results[idx] = {
                ...results[idx],
                status: 'error',
                error: error.error,
              };
            }
          });
        } else {
          batch.forEach((item) => {
            const idx = results.findIndex(r => r.file.name === item.file.name);
            if (idx >= 0) {
              results[idx] = {
                ...results[idx],
                status: 'error',
                error: data.error || 'Upload failed',
              };
            }
          });
        }
      } catch (error) {
        batch.forEach((item) => {
          const idx = results.findIndex(r => r.file.name === item.file.name);
          if (idx >= 0) {
            results[idx] = {
              ...results[idx],
              status: 'error',
              error: 'Network error',
            };
          }
        });
      }

      setFiles([...results]);
      
      const completedCount = results.filter(r => r.status === 'complete' || r.status === 'error').length;
      setUploadProgress({
        current: completedCount,
        total: files.length,
      });
      setProgress({
        processedImages: completedCount,
        currentStep: `Processing images (${completedCount}/${files.length})...`,
      });

      // Small delay between batches to avoid rate limits
      if (i + batchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setProgress({
      status: 'complete',
      currentStep: 'Upload complete!',
    });
    setIsUploading(false);
  };

  const successCount = files.filter((f) => f.status === 'complete').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const pendingCount = files.filter((f) => f.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <Card variant="bordered" padding="none">
        <div
          {...getRootProps()}
          className={cn(
            'flex flex-col items-center justify-center p-12 cursor-pointer transition-all duration-300',
            'border-2 border-dashed rounded-xl',
            isDragActive
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'
          )}
        >
          <input {...getInputProps()} />
          <motion.div
            animate={{
              scale: isDragActive ? 1.1 : 1,
              rotate: isDragActive ? 5 : 0,
            }}
            className="mb-4"
          >
            <div className="p-4 rounded-full bg-slate-800">
              <Upload
                className={cn(
                  'h-8 w-8 transition-colors',
                  isDragActive ? 'text-brand-500' : 'text-slate-400'
                )}
              />
            </div>
          </motion.div>
          <p className="text-lg font-medium text-slate-200 mb-2">
            {isDragActive ? 'Drop your images here' : 'Drag & drop images here'}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            or click to browse your files
          </p>
          <p className="text-xs text-slate-600">
            Supports JPG, PNG, WebP up to 10MB each
          </p>
        </div>
      </Card>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Summary Stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-slate-300">
                  <span className="font-semibold text-slate-100">{files.length}</span>{' '}
                  images selected
                </span>
                {successCount > 0 && (
                  <Badge variant="success">{successCount} processed</Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="error">{errorCount} failed</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    files.forEach((f) => URL.revokeObjectURL(f.preview));
                    setFiles([]);
                  }}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
                <Button
                  variant="primary"
                  onClick={handleUpload}
                  isLoading={isUploading}
                  disabled={pendingCount === 0 && !isUploading}
                >
                  {isUploading
                    ? `Processing (${uploadProgress.current}/${uploadProgress.total})`
                    : `Upload ${pendingCount} Images`}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <Progress
                value={uploadProgress.current}
                max={uploadProgress.total}
                size="md"
                variant="brand"
              />
            )}

            {/* File Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {files.map((item, index) => (
                <motion.div
                  key={`${item.file.name}-${index}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group"
                >
                  <Card
                    variant="bordered"
                    padding="none"
                    className={cn(
                      'overflow-hidden aspect-square',
                      item.status === 'error' && 'border-red-500/50'
                    )}
                  >
                    {/* Image Preview */}
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />

                    {/* Status Overlay */}
                    <div
                      className={cn(
                        'absolute inset-0 flex items-center justify-center transition-opacity',
                        item.status === 'pending' && 'bg-transparent',
                        item.status === 'compressing' && 'bg-slate-900/70',
                        item.status === 'uploading' && 'bg-slate-900/70',
                        item.status === 'processing' && 'bg-slate-900/70',
                        item.status === 'complete' && 'bg-emerald-900/30',
                        item.status === 'error' && 'bg-red-900/50'
                      )}
                    >
                      {item.status === 'compressing' && (
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 text-amber-500 animate-spin mx-auto mb-2" />
                          <p className="text-xs text-amber-300">Compressing...</p>
                        </div>
                      )}
                      {item.status === 'uploading' && (
                        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
                      )}
                      {item.status === 'processing' && (
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 text-brand-500 animate-spin mx-auto mb-2" />
                          <p className="text-xs text-slate-300">Extracting caption...</p>
                        </div>
                      )}
                      {item.status === 'complete' && (
                        <div className="absolute top-2 right-2">
                          <div className="p-1 rounded-full bg-emerald-500">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="text-center p-2">
                          <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-1" />
                          <p className="text-xs text-red-300">{item.error}</p>
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {/* Caption Preview */}
                    {item.status === 'complete' && item.extractedCaption && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-slate-900/90 to-transparent">
                        <p className="text-xs text-slate-200 line-clamp-2">
                          "{item.extractedCaption}"
                        </p>
                        <div className="flex gap-1 mt-1">
                          {item.confidence !== undefined && item.confidence < 0.8 && (
                            <Badge size="sm" variant="warning">
                              Low confidence
                            </Badge>
                          )}
                          {item.compressed && (
                            <Badge size="sm" variant="info">
                              Compressed
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* File Name */}
                  <p className="mt-2 text-xs text-slate-500 truncate">
                    {item.file.name}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {files.length === 0 && (
        <Card variant="bordered" className="text-center">
          <FileImage className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            No images uploaded yet
          </h3>
          <p className="text-sm text-slate-500">
            Upload your existing content library to train the caption generator
          </p>
        </Card>
      )}
    </div>
  );
}
