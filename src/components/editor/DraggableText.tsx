'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface DraggableTextProps {
  text: string;
  x: number;           // 0-100%
  y: number;           // 0-100%
  fontSize: number;
  width: number;       // Text box width as % (20-100)
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  onPositionChange: (x: number, y: number) => void;
}

export function DraggableText({
  text,
  x,
  y,
  fontSize,
  width,
  textAlign,
  textColor,
  onPositionChange,
}: DraggableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x, y });

  // Sync position from props when they change externally
  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (position.x / 100) * (containerRef.current?.clientWidth || 0),
      y: e.clientY - (position.y / 100) * (containerRef.current?.clientHeight || 0),
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = ((e.clientX - dragStart.x) / containerRect.width) * 100;
    const newY = ((e.clientY - dragStart.y) / containerRect.height) * 100;

    // Clamp to bounds (allow some overflow for edge positioning)
    const clampedX = Math.max(5, Math.min(95, newX));
    const clampedY = Math.max(5, Math.min(95, newY));

    setPosition({ x: clampedX, y: clampedY });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onPositionChange(position.x, position.y);
    }
  }, [isDragging, position, onPositionChange]);

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Get resolved color
  const resolvedColor = textColor === 'black' ? '#000000' :
                        textColor === 'white' ? '#FFFFFF' :
                        textColor; // accent color is already hex

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      <div
        ref={textRef}
        className="pointer-events-auto select-none"
        style={{
          position: 'absolute',
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
          width: `${width}%`,
          fontSize: `${fontSize}px`,
          fontFamily: "'Jost', 'Futura', 'Century Gothic', Arial, sans-serif",
          fontWeight: 700,
          fontStyle: 'italic',
          color: resolvedColor,
          textShadow: '2px 2px 4px rgba(0,0,0,0.6)',
          textAlign,
          cursor: isDragging ? 'grabbing' : 'grab',
          lineHeight: 1.3,
          wordWrap: 'break-word',
        }}
        onMouseDown={handleMouseDown}
      >
        {text}
      </div>
    </div>
  );
}
