/**
 * Image Text Editor Component
 * Wrapper for dynamic import of Fabric.js canvas (SSR disabled)
 */

'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui';

// Dynamic import with SSR disabled (Fabric.js requires browser APIs)
const ImageTextEditorClient = dynamic(
  () => import('./ImageTextEditorClient').then(mod => mod.ImageTextEditorClient),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[4/5] bg-gray-100 rounded-lg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }
);

interface ImageTransform {
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

export interface ImageTextEditorProps {
  imageUrl: string;
  caption: string;
  x: number;
  y: number;
  fontSize: number;
  width: number;
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  // Image transform props (optional)
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  onSettingsChange: (settings: { x: number; y: number; fontSize: number; width: number }) => void;
  onImageTransformChange?: (transform: ImageTransform) => void;
}

export function ImageTextEditor(props: ImageTextEditorProps) {
  return <ImageTextEditorClient {...props} />;
}

export default ImageTextEditor;
