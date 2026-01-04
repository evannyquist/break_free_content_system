'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  Download,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';
import { DayPlanner } from './DayPlanner';
import { cn } from '@/lib/utils';
import type { WeekPlan, DayContent, DayStatus } from '@/types';

interface WeeklyPlannerProps {
  onExportWeek?: (weekPlan: WeekPlan) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusIcon(status: DayStatus, imageCount: number) {
  if (status === 'complete') {
    return <Check className="h-4 w-4 text-emerald-600" />;
  }
  if (imageCount > 0) {
    return <span className="text-xs font-bold text-brand-600">{imageCount}</span>;
  }
  return <span className="text-xs text-gray-400">0</span>;
}

function getStatusColor(status: DayStatus): string {
  switch (status) {
    case 'complete':
      return 'border-emerald-300 bg-emerald-50';
    case 'captions-selected':
      return 'border-brand-300 bg-brand-50';
    case 'captions-generated':
      return 'border-amber-300 bg-amber-50';
    case 'images-selected':
      return 'border-blue-300 bg-blue-50';
    default:
      return 'border-gray-200 bg-white';
  }
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

export function WeeklyPlanner({ onExportWeek }: WeeklyPlannerProps) {
  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initialize week plan
  useEffect(() => {
    initializeWeek();
  }, [weekOffset]);

  const initializeWeek = useCallback(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    const weekStart = getWeekStartDate(today);

    const days: DayContent[] = DAYS_OF_WEEK.map((dayOfWeek, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return {
        date: date.toISOString().split('T')[0],
        dayOfWeek,
        images: [],
        status: 'pending' as DayStatus,
      };
    });

    setWeekPlan({
      id: `week-${weekStart.toISOString().split('T')[0]}`,
      weekStartDate: weekStart.toISOString().split('T')[0],
      days,
      status: 'in-progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, [weekOffset]);

  const handleDayUpdate = useCallback((dayIndex: number, updatedDay: DayContent) => {
    setWeekPlan(prev => {
      if (!prev) return prev;
      const newDays = [...prev.days];
      newDays[dayIndex] = updatedDay;

      // Check if all days are complete
      const allComplete = newDays.every(d => d.status === 'complete');

      return {
        ...prev,
        days: newDays,
        status: allComplete ? 'complete' : 'in-progress',
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleBackToWeek = useCallback(() => {
    setSelectedDayIndex(null);
  }, []);

  const getWeekProgress = () => {
    if (!weekPlan) return { complete: 0, total: 7, images: 0 };
    const complete = weekPlan.days.filter(d => d.status === 'complete').length;
    const images = weekPlan.days.reduce((sum, d) => sum + d.images.length, 0);
    return { complete, total: 7, images };
  };

  const canExport = weekPlan?.status === 'complete' ||
    (weekPlan?.days.some(d => d.status === 'complete'));

  if (!weekPlan) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  const progress = getWeekProgress();

  // Show day planner if a day is selected
  if (selectedDayIndex !== null) {
    return (
      <DayPlanner
        day={weekPlan.days[selectedDayIndex]}
        dayIndex={selectedDayIndex}
        onUpdate={(updatedDay) => handleDayUpdate(selectedDayIndex, updatedDay)}
        onBack={handleBackToWeek}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Date/Time Display */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
        <span>
          {currentTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })}
        </span>
      </div>

      {/* Week Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Week of {formatDateShort(weekPlan.weekStartDate)}
            </h2>
            <p className="text-sm text-gray-500">
              {progress.complete}/7 days complete · {progress.images} images
            </p>
          </div>

          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
            >
              Today
            </Button>
          )}

          {canExport && (
            <Button
              variant="primary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => onExportWeek?.(weekPlan)}
            >
              Export Week
            </Button>
          )}
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-3">
        {weekPlan.days.map((day, index) => (
          <motion.button
            key={day.date}
            onClick={() => setSelectedDayIndex(index)}
            className={cn(
              'p-4 rounded-xl border-2 transition-all text-left',
              'hover:border-brand-400 hover:shadow-lg',
              getStatusColor(day.status),
              // Highlight today with darker border (only when viewing current week)
              weekOffset === 0 && isToday(day.date) && 'ring-2 ring-gray-400 ring-offset-1'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">
                {day.dayOfWeek.slice(0, 3)}
              </span>
              {getStatusIcon(day.status, day.images.length)}
            </div>

            <p className="text-lg font-bold text-gray-900">
              {new Date(day.date).getDate()}
            </p>

            {/* Status indicator */}
            <div className="mt-3 space-y-1">
              {day.status === 'pending' && (
                <span className="text-xs text-gray-400">Click to start</span>
              )}
              {day.status === 'images-selected' && (
                <span className="text-xs text-blue-600">
                  {day.images.length} images
                </span>
              )}
              {day.status === 'captions-generated' && (
                <span className="text-xs text-amber-600">
                  Select captions
                </span>
              )}
              {day.status === 'captions-selected' && (
                <span className="text-xs text-brand-600">
                  Ready to finalize
                </span>
              )}
              {day.status === 'complete' && (
                <span className="text-xs text-emerald-600">
                  Complete
                </span>
              )}
            </div>

            {/* Preview thumbnails */}
            {day.images.length > 0 && (
              <div className="mt-3 flex -space-x-2">
                {day.images.slice(0, 4).map((img, i) => (
                  <div
                    key={img.id}
                    className="w-8 h-8 rounded-lg border-2 border-white overflow-hidden bg-gray-200 shadow-sm"
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {day.images.length > 4 && (
                  <div className="w-8 h-8 rounded-lg border-2 border-white bg-gray-200 flex items-center justify-center shadow-sm">
                    <span className="text-xs text-gray-500">
                      +{day.images.length - 4}
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Week Summary */}
      <Card variant="bordered" className="p-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700">
                {progress.complete} days complete
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700">
                {progress.images} images selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700">
                {weekPlan.days.filter(d =>
                  d.status === 'complete' ||
                  d.status === 'captions-selected'
                ).reduce((sum, d) => sum + d.images.length, 0)} captions ready
              </span>
            </div>
          </div>

          <Badge
            variant={
              weekPlan.status === 'complete' ? 'success' :
              weekPlan.status === 'exported' ? 'info' : 'default'
            }
          >
            {weekPlan.status === 'complete' ? 'Ready to Export' :
             weekPlan.status === 'exported' ? 'Exported' : 'In Progress'}
          </Badge>
        </div>
      </Card>

      {/* Help text */}
      <div className="text-center text-sm text-gray-500">
        Click on a day to select 6 images and generate captions
      </div>
    </div>
  );
}
