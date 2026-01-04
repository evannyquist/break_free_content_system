/**
 * Main Application Page
 * Complete dashboard with navigation and content areas
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Library,
  Sparkles,
  Settings,
  Menu,
  X,
  Upload,
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  Zap,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Button, Card, Badge, Progress, Spinner, EmptyState, Toast } from '@/components/ui';
import { LibraryUpload } from '@/components/library/LibraryUpload';
import { LibraryGallery } from '@/components/library/LibraryGallery';
import { BrandVoiceProfileView } from '@/components/library/BrandVoiceProfile';
import { CarouselPreview } from '@/components/content/CarouselPreview';
import { GenerationPanel } from '@/components/content/GenerationPanel';
import CosmosBrowser from '@/components/cosmos/CosmosBrowser';
import { WeeklyPlanner } from '@/components/planner';
import { cn, formatDate } from '@/lib/utils';
import type {
  LibraryImage,
  BrandVoiceProfile,
  CarouselContent,
  GenerationSettings,
  WeekPlan,
} from '@/types';

type Tab = 'dashboard' | 'planner' | 'library' | 'cosmos' | 'generate' | 'settings';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Data states
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [brandProfile, setBrandProfile] = useState<BrandVoiceProfile | null>(null);
  const [carousels, setCarousels] = useState<CarouselContent[]>([]);
  const [settings, setSettings] = useState<GenerationSettings>({
    imageMode: 'stock',
    stockSource: 'both',
    brandVoiceStrictness: 70,
    imageStyle: 'epic cinematic',
    imageQuality: 'standard',
    themeCategories: [],
    excludedThemes: [],
  });

  // Loading states
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isLoadingCarousels, setIsLoadingCarousels] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, status: '' });

  // Selected carousel for preview
  const [selectedCarousel, setSelectedCarousel] = useState<CarouselContent | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load data on mount
  useEffect(() => {
    loadLibrary();
    loadCarousels();
    loadSettings();
  }, []);

  const loadLibrary = async () => {
    try {
      setIsLoadingLibrary(true);
      const response = await fetch('/api/library');
      const data = await response.json();
      if (data.success) {
        setLibraryImages(data.images || []);
      }
      
      // Also load profile
      const profileResponse = await fetch('/api/library/analyze');
      const profileData = await profileResponse.json();
      if (profileData.profile) {
        setBrandProfile(profileData.profile);
      }
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const loadCarousels = async () => {
    try {
      setIsLoadingCarousels(true);
      const response = await fetch('/api/generate');
      const data = await response.json();
      if (data.success) {
        setCarousels(data.carousels || []);
      }
    } catch (error) {
      console.error('Failed to load carousels:', error);
    } finally {
      setIsLoadingCarousels(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleAnalyzeLibrary = async () => {
    try {
      setIsAnalyzing(true);
      const response = await fetch('/api/library/analyze', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setBrandProfile(data.profile);
        addToast('success', 'Brand voice profile created successfully!');
      } else {
        addToast('error', data.error || 'Analysis failed');
      }
    } catch (error) {
      addToast('error', 'Failed to analyze library');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async (dates: string[], imageMode: 'ai' | 'stock') => {
    try {
      setIsGenerating(true);
      setGenerationProgress({ current: 0, total: dates.length, status: 'Starting generation...' });

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates, imageMode }),
      });

      const data = await response.json();
      if (data.success) {
        setCarousels((prev) => [...prev, ...data.carousels]);
        addToast('success', `Generated ${data.carousels.length} carousels!`);
        if (data.carousels.length > 0) {
          setSelectedCarousel(data.carousels[0]);
        }
      } else {
        addToast('error', data.error || 'Generation failed');
      }
    } catch (error) {
      addToast('error', 'Failed to generate content');
    } finally {
      setIsGenerating(false);
      setGenerationProgress({ current: 0, total: 0, status: '' });
    }
  };

  const handleUpdateSettings = async (updates: Partial<GenerationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleExportCarousel = async (carouselId: string) => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselIds: [carouselId],
          options: {
            format: 'zip',
            includeMetadata: true,
            namingConvention: 'date-index',
            captionFormat: 'json',
          },
        }),
      });

      const data = await response.json();
      if (data.success && data.zipBase64) {
        // Create download link
        const blob = new Blob(
          [Uint8Array.from(atob(data.zipBase64), (c) => c.charCodeAt(0))],
          { type: 'application/zip' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.exportName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', 'Export downloaded!');
      }
    } catch (error) {
      addToast('error', 'Export failed');
    }
  };

  // Navigation items
  const navItems = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner' as Tab, label: 'Weekly Planner', icon: Calendar },
    { id: 'library' as Tab, label: 'Library', icon: Library },
    { id: 'cosmos' as Tab, label: 'Cosmos', icon: Globe },
    { id: 'generate' as Tab, label: 'Generate', icon: Sparkles },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  const handleExportWeek = async (weekPlan: WeekPlan) => {
    try {
      const response = await fetch('/api/export/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekPlan }),
      });

      const data = await response.json();
      if (data.success && data.zipBase64) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.zipBase64), (c) => c.charCodeAt(0))],
          { type: 'application/zip' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.exportName || 'break-free-week'}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', 'Week exported successfully!');
      } else {
        addToast('error', data.error || 'Export failed');
      }
    } catch (error) {
      addToast('error', 'Failed to export week');
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || !isMobile) && (
          <motion.aside
            initial={isMobile ? { x: -280 } : false}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className={cn(
              'fixed lg:relative z-40 h-screen w-72 flex flex-col',
              'bg-white border-r border-gray-200'
            )}
          >
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="font-bold text-gray-900">Break Free</h1>
                    <p className="text-xs text-gray-500">Content System</p>
                  </div>
                </div>
                {isMobile && (
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                    activeTab === item.id
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Stats */}
            <div className="p-4 border-t border-gray-200">
              <div className="p-4 rounded-lg bg-gray-50 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Library Size</span>
                  <span className="text-gray-900 font-medium">
                    {libraryImages.length} images
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Carousels</span>
                  <span className="text-gray-900 font-medium">
                    {carousels.length} generated
                  </span>
                </div>
                {brandProfile && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Voice Profile</span>
                    <Badge size="sm" variant="success">Active</Badge>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-gray-500 hover:text-gray-900"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-900">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'library' && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={loadLibrary}
                >
                  Refresh
                </Button>
              )}
              {activeTab === 'generate' && brandProfile && (
                <Badge variant="success">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Brand Voice Active
                </Badge>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <DashboardContent
              libraryCount={libraryImages.length}
              carouselCount={carousels.length}
              hasProfile={!!brandProfile}
              recentCarousels={carousels.slice(0, 3)}
              onViewCarousel={setSelectedCarousel}
              onNavigate={setActiveTab}
            />
          )}

          {/* Weekly Planner */}
          {activeTab === 'planner' && (
            <WeeklyPlanner onExportWeek={handleExportWeek} />
          )}

          {/* Library */}
          {activeTab === 'library' && (
            <div className="space-y-8">
              <LibraryUpload />
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Content Library
                </h3>
                <LibraryGallery
                  images={libraryImages}
                  isLoading={isLoadingLibrary}
                  onRefresh={loadLibrary}
                />
              </div>
              <div className="border-t border-gray-200 pt-8">
                <BrandVoiceProfileView
                  profile={brandProfile}
                  isAnalyzing={isAnalyzing}
                  onAnalyze={handleAnalyzeLibrary}
                />
              </div>
            </div>
          )}

          {/* Cosmos Browser */}
          {activeTab === 'cosmos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500">
                    Browse cosmos.so for vintage film images, select images you like, and generate captions that match each image.
                  </p>
                </div>
              </div>
              <CosmosBrowser
                onCarouselCreated={(carouselId) => {
                  loadCarousels();
                  addToast('success', 'Carousel created from Cosmos images!');
                }}
              />
            </div>
          )}

          {/* Generate */}
          {activeTab === 'generate' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <GenerationPanel
                settings={settings}
                profile={brandProfile}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                progress={generationProgress}
                onUpdateSettings={handleUpdateSettings}
              />
              <div className="space-y-6">
                {selectedCarousel ? (
                  <CarouselPreview
                    carousel={selectedCarousel}
                    onExport={() => handleExportCarousel(selectedCarousel.id)}
                  />
                ) : carousels.length > 0 ? (
                  <Card variant="bordered" className="p-8 text-center">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      Select a Carousel
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Choose from {carousels.length} generated carousels to preview
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {carousels.slice(0, 5).map((carousel) => (
                        <Button
                          key={carousel.id}
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedCarousel(carousel)}
                        >
                          {formatDate(carousel.date).split(',')[0]}
                        </Button>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <Card variant="bordered" className="p-8 text-center">
                    <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      No Carousels Yet
                    </h3>
                    <p className="text-sm text-gray-500">
                      Generate your first carousel using the panel on the left
                    </p>
                  </Card>
                )}

                {/* Recent Carousels List */}
                {carousels.length > 0 && (
                  <Card variant="bordered">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      Generated Carousels
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {carousels.map((carousel) => (
                        <button
                          key={carousel.id}
                          onClick={() => setSelectedCarousel(carousel)}
                          className={cn(
                            'w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left',
                            selectedCarousel?.id === carousel.id
                              ? 'bg-brand-50 border border-brand-200'
                              : 'bg-gray-50 hover:bg-gray-100'
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {formatDate(carousel.date).split(',')[0]}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {carousel.theme}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              size="sm"
                              variant={
                                carousel.brandVoiceScore >= 80
                                  ? 'success'
                                  : 'warning'
                              }
                            >
                              {carousel.brandVoiceScore}%
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <SettingsContent
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </div>
      </main>

      {/* Toasts */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              type={toast.type}
              message={toast.message}
              onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Dashboard Content Component
function DashboardContent({
  libraryCount,
  carouselCount,
  hasProfile,
  recentCarousels,
  onViewCarousel,
  onNavigate,
}: {
  libraryCount: number;
  carouselCount: number;
  hasProfile: boolean;
  recentCarousels: CarouselContent[];
  onViewCarousel: (carousel: CarouselContent) => void;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card variant="bordered" padding="lg" className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to Break Free Content System
          </h2>
          <p className="text-gray-600 mb-6 max-w-xl">
            Generate engaging Instagram carousels with humorous running captions
            and epic imagery that matches your brand voice.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => onNavigate('generate')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Content
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('library')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Library
            </Button>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 w-64 h-64 opacity-5">
          <Zap className="w-full h-full text-brand-500" />
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="bordered" className="card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Library Size</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {libraryCount}
              </p>
              <p className="text-sm text-gray-400 mt-1">images uploaded</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-100">
              <Library className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Carousels Generated</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {carouselCount}
              </p>
              <p className="text-sm text-gray-400 mt-1">ready for posting</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100">
              <Calendar className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card variant="bordered" className="card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Brand Voice</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {hasProfile ? 'Active' : 'Setup'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {hasProfile ? 'profile trained' : 'needs configuration'}
              </p>
            </div>
            <div
              className={cn(
                'p-3 rounded-xl',
                hasProfile ? 'bg-brand-100' : 'bg-amber-100'
              )}
            >
              <BarChart3
                className={cn(
                  'h-6 w-6',
                  hasProfile ? 'text-brand-600' : 'text-amber-600'
                )}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="bordered">
          <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('generate')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <Sparkles className="h-5 w-5 text-brand-500" />
              <div>
                <p className="font-medium text-gray-800">Generate Week</p>
                <p className="text-sm text-gray-500">Create 7 days of content</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('library')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <Upload className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium text-gray-800">Upload Images</p>
                <p className="text-sm text-gray-500">Add to content library</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('cosmos')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <Globe className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="font-medium text-gray-800">Browse Cosmos</p>
                <p className="text-sm text-gray-500">Find vintage film images</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <Settings className="h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-800">Configure Settings</p>
                <p className="text-sm text-gray-500">Adjust generation options</p>
              </div>
            </button>
          </div>
        </Card>

        <Card variant="bordered">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Carousels</h3>
          {recentCarousels.length > 0 ? (
            <div className="space-y-2">
              {recentCarousels.map((carousel) => (
                <button
                  key={carousel.id}
                  onClick={() => {
                    onViewCarousel(carousel);
                    onNavigate('generate');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-800 capitalize">
                      {carousel.theme}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(carousel.date).split(',')[0]}
                    </p>
                  </div>
                  <Badge
                    size="sm"
                    variant={
                      carousel.brandVoiceScore >= 80 ? 'success' : 'warning'
                    }
                  >
                    {carousel.brandVoiceScore}%
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No carousels generated yet</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Settings Content Component
function SettingsContent({
  settings,
  onUpdateSettings,
}: {
  settings: GenerationSettings;
  onUpdateSettings: (updates: Partial<GenerationSettings>) => void;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      <Card variant="bordered">
        <h3 className="font-semibold text-gray-800 mb-6">Image Generation</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Default Image Mode
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => onUpdateSettings({ imageMode: 'stock' })}
                className={cn(
                  'flex-1 p-4 rounded-lg border transition-all',
                  settings.imageMode === 'stock'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                )}
              >
                <p className="font-medium text-gray-800">Stock Photos</p>
                <p className="text-sm text-gray-500 mt-1">
                  Use Pexels & Unsplash (Free)
                </p>
              </button>
              <button
                onClick={() => onUpdateSettings({ imageMode: 'ai' })}
                className={cn(
                  'flex-1 p-4 rounded-lg border transition-all',
                  settings.imageMode === 'ai'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                )}
              >
                <p className="font-medium text-gray-800">AI Generated</p>
                <p className="text-sm text-gray-500 mt-1">
                  Use Flux Pro 1.1 (Paid)
                </p>
              </button>
            </div>
          </div>

          {settings.imageMode === 'stock' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Photo Source
              </label>
              <select
                value={settings.stockSource}
                onChange={(e) =>
                  onUpdateSettings({
                    stockSource: e.target.value as 'pexels' | 'unsplash' | 'both',
                  })
                }
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-800"
              >
                <option value="both">Both (Pexels + Unsplash)</option>
                <option value="pexels">Pexels Only</option>
                <option value="unsplash">Unsplash Only</option>
              </select>
            </div>
          )}

          {settings.imageMode === 'ai' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image Quality
              </label>
              <select
                value={settings.imageQuality}
                onChange={(e) =>
                  onUpdateSettings({
                    imageQuality: e.target.value as 'standard' | 'hd',
                  })
                }
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-800"
              >
                <option value="standard">Standard</option>
                <option value="hd">HD (Higher cost)</option>
              </select>
            </div>
          )}
        </div>
      </Card>

      <Card variant="bordered">
        <h3 className="font-semibold text-gray-800 mb-6">Brand Voice</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Voice Strictness
              </label>
              <span className="text-sm font-medium text-brand-600">
                {settings.brandVoiceStrictness}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.brandVoiceStrictness}
              onChange={(e) =>
                onUpdateSettings({
                  brandVoiceStrictness: Number(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              Higher = closer match to library style. Lower = more creative variation.
            </p>
          </div>
        </div>
      </Card>

      <Card variant="bordered">
        <h3 className="font-semibold text-gray-800 mb-4">API Configuration</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure your API keys in the <code>.env.local</code> file.
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Anthropic (Claude)</span>
            <Badge variant="success" size="sm">Required</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Replicate (Flux Pro)</span>
            <Badge variant="info" size="sm">For AI Images</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Pexels</span>
            <Badge variant="info" size="sm">For Stock Photos</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-700">Unsplash</span>
            <Badge variant="info" size="sm">For Stock Photos</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
