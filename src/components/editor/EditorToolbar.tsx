/**
 * Editor Toolbar Component
 * Controls for text color, font size, and reset position
 */

'use client';

import React from 'react';
import { Palette, Type, RotateCcw, RefreshCw, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Button, Slider } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TextColorOption, TextAlignment } from '@/types';

interface EditorToolbarProps {
  textColor: TextColorOption;
  fontSize: number;
  textAlign: TextAlignment;
  accentColor?: string;
  isLoadingAccent?: boolean;
  onColorChange: (color: TextColorOption) => void;
  onFontSizeChange: (size: number) => void;
  onAlignmentChange: (align: TextAlignment) => void;
  onResetPosition: () => void;
}

const COLOR_OPTIONS: { value: TextColorOption; label: string; color: string }[] = [
  { value: 'white', label: 'White', color: '#FFFFFF' },
  { value: 'black', label: 'Black', color: '#000000' },
  { value: 'accent', label: 'Accent', color: 'accent' },
];

const ALIGNMENT_OPTIONS: { value: TextAlignment; label: string; icon: React.ReactNode }[] = [
  { value: 'left', label: 'Left', icon: <AlignLeft className="h-4 w-4" /> },
  { value: 'center', label: 'Center', icon: <AlignCenter className="h-4 w-4" /> },
  { value: 'right', label: 'Right', icon: <AlignRight className="h-4 w-4" /> },
];

export function EditorToolbar({
  textColor,
  fontSize,
  textAlign,
  accentColor,
  isLoadingAccent,
  onColorChange,
  onFontSizeChange,
  onAlignmentChange,
  onResetPosition,
}: EditorToolbarProps) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Color Selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Palette className="h-4 w-4" />
          Text Color
        </label>
        <div className="flex gap-2">
          {COLOR_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onColorChange(opt.value)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2',
                textColor === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-gray-300 hover:border-gray-400 text-gray-600 bg-white'
              )}
            >
              {opt.value === 'accent' ? (
                isLoadingAccent ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : accentColor ? (
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: accentColor }}
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
                )
              ) : (
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size and Alignment Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Font Size Slider */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Type className="h-4 w-4" />
            Font Size: {fontSize}px
          </label>
          <Slider
            value={fontSize}
            onChange={onFontSizeChange}
            min={24}
            max={96}
            step={2}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>24px</span>
            <span>96px</span>
          </div>
        </div>

        {/* Text Alignment */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Alignment
          </label>
          <div className="flex gap-1">
            {ALIGNMENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onAlignmentChange(opt.value)}
                title={opt.label}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border transition-all flex items-center justify-center',
                  textAlign === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600 bg-white'
                )}
              >
                {opt.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reset Position */}
      <div className="flex justify-end pt-2 border-t border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={onResetPosition}
        >
          Reset Position
        </Button>
      </div>
    </div>
  );
}

export default EditorToolbar;
