/**
 * Image Text Editor Client Component
 * Uses react-easy-crop for image cropping with a separate draggable text overlay
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { DraggableText } from './DraggableText';

interface ImageTransform {
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

interface ImageTextEditorClientProps {
  imageUrl: string;
  caption: string;
  x: number;
  y: number;
  fontSize: number;
  width: number;
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  onSettingsChange: (settings: { x: number; y: number; fontSize: number; width: number }) => void;
  onImageTransformChange?: (transform: ImageTransform) => void;
}

// Scale factor for converting between crop coordinates and our percentage system
const CROP_SCALE = 100;

export function ImageTextEditorClient({
  imageUrl,
  caption,
  x,
  y,
  fontSize,
  width,
  textAlign,
  textColor,
  imageScale = 1,
  imageOffsetX = 0,
  imageOffsetY = 0,
  onSettingsChange,
  onImageTransformChange,
}: ImageTextEditorClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 500 });

  // Convert our offset (-50 to 50) to react-easy-crop's crop position
  // react-easy-crop uses pixels from center, we use percentage of overflow
  const initialCrop = {
    x: imageOffsetX * CROP_SCALE / 50,
    y: imageOffsetY * CROP_SCALE / 50,
  };

  const [crop, setCrop] = useState<Point>(initialCrop);
  const [zoom, setZoom] = useState(imageScale);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Debounce timer for transform changes
  const transformTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        // Maintain 4:5 aspect ratio
        const cropWidth = Math.min(containerWidth, 600);
        const cropHeight = cropWidth * 1.25;
        setContainerSize({ width: cropWidth, height: cropHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Sync zoom from props when it changes externally
  useEffect(() => {
    setZoom(imageScale);
  }, [imageScale]);

  // Sync crop from props when they change externally
  useEffect(() => {
    setCrop({
      x: imageOffsetX * CROP_SCALE / 50,
      y: imageOffsetY * CROP_SCALE / 50,
    });
  }, [imageOffsetX, imageOffsetY]);

  const onCropChange = useCallback((newCrop: Point) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);

    // Debounce the callback to avoid excessive updates
    if (transformTimerRef.current) {
      clearTimeout(transformTimerRef.current);
    }

    transformTimerRef.current = setTimeout(() => {
      // Convert react-easy-crop coordinates to our format
      // crop.x/y are in pixels from center, we want -50 to 50 percentage
      const offsetX = (crop.x / CROP_SCALE) * 50;
      const offsetY = (crop.y / CROP_SCALE) * 50;

      onImageTransformChange?.({
        imageScale: zoom,
        imageOffsetX: Math.max(-50, Math.min(50, offsetX)),
        imageOffsetY: Math.max(-50, Math.min(50, offsetY)),
      });
    }, 100);
  }, [crop, zoom, onImageTransformChange]);

  const handleTextPositionChange = useCallback((newX: number, newY: number) => {
    onSettingsChange({
      x: newX,
      y: newY,
      fontSize,
      width,
    });
  }, [fontSize, width, onSettingsChange]);

  // Scale font size relative to container
  const scaledFontSize = Math.round(fontSize * (containerSize.width / 500));

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative rounded-xl overflow-hidden bg-gray-200"
        style={{
          width: containerSize.width,
          height: containerSize.height,
          margin: '0 auto',
        }}
      >
        {/* Image Cropper */}
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={4 / 5}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          showGrid={false}
          minZoom={1}
          maxZoom={5}
          zoomSpeed={0.1}
          style={{
            containerStyle: {
              width: '100%',
              height: '100%',
              backgroundColor: '#e5e7eb',
            },
            cropAreaStyle: {
              border: '2px solid #6b7280',
            },
            mediaStyle: {
              // Ensure image covers the crop area
            },
          }}
          classes={{
            containerClassName: 'rounded-xl',
          }}
        />

        {/* Text Overlay */}
        {caption && (
          <DraggableText
            text={caption}
            x={x}
            y={y}
            fontSize={scaledFontSize}
            width={width}
            textAlign={textAlign}
            textColor={textColor}
            onPositionChange={handleTextPositionChange}
          />
        )}
      </div>

      {/* Zoom slider */}
      <div className="mt-4 flex items-center gap-3 px-4">
        <span className="text-sm text-gray-500 w-12">Zoom</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.1}
          value={zoom}
          onChange={(e) => {
            const newZoom = parseFloat(e.target.value);
            setZoom(newZoom);
            onImageTransformChange?.({
              imageScale: newZoom,
              imageOffsetX: (crop.x / CROP_SCALE) * 50,
              imageOffsetY: (crop.y / CROP_SCALE) * 50,
            });
          }}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <span className="text-sm text-gray-500 w-12 text-right">{zoom.toFixed(1)}x</span>
      </div>
    </div>
  );
}
