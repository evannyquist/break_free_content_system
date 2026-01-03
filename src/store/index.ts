/**
 * Global State Store
 * Uses Zustand for state management across the application
 */

import { create } from 'zustand';
import type {
  LibraryImage,
  BrandVoiceProfile,
  CarouselContent,
  GenerationSettings,
  LibraryAnalysisProgress,
  ApiUsageStats,
} from '@/types';

// =====================================
// Library Store
// =====================================

interface LibraryState {
  images: LibraryImage[];
  profile: BrandVoiceProfile | null;
  progress: LibraryAnalysisProgress;
  isLoading: boolean;
  
  // Actions
  setImages: (images: LibraryImage[]) => void;
  addImages: (images: LibraryImage[]) => void;
  updateImage: (id: string, updates: Partial<LibraryImage>) => void;
  removeImage: (id: string) => void;
  setProfile: (profile: BrandVoiceProfile | null) => void;
  setProgress: (progress: Partial<LibraryAnalysisProgress>) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialLibraryProgress: LibraryAnalysisProgress = {
  status: 'idle',
  totalImages: 0,
  processedImages: 0,
  currentStep: '',
};

export const useLibraryStore = create<LibraryState>((set) => ({
  images: [],
  profile: null,
  progress: initialLibraryProgress,
  isLoading: false,

  setImages: (images) => set({ images }),
  
  addImages: (newImages) =>
    set((state) => ({
      images: [...state.images, ...newImages],
    })),
  
  updateImage: (id, updates) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    })),
  
  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
    })),
  
  setProfile: (profile) => set({ profile }),
  
  setProgress: (progress) =>
    set((state) => ({
      progress: { ...state.progress, ...progress },
    })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  reset: () =>
    set({
      images: [],
      profile: null,
      progress: initialLibraryProgress,
      isLoading: false,
    }),
}));

// =====================================
// Content Store
// =====================================

interface ContentState {
  carousels: CarouselContent[];
  selectedDate: string | null;
  selectedCarousel: CarouselContent | null;
  isGenerating: boolean;
  generationProgress: {
    current: number;
    total: number;
    status: string;
  };
  
  // Actions
  setCarousels: (carousels: CarouselContent[]) => void;
  addCarousel: (carousel: CarouselContent) => void;
  updateCarousel: (id: string, updates: Partial<CarouselContent>) => void;
  removeCarousel: (id: string) => void;
  setSelectedDate: (date: string | null) => void;
  setSelectedCarousel: (carousel: CarouselContent | null) => void;
  setGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: { current: number; total: number; status: string }) => void;
}

export const useContentStore = create<ContentState>((set) => ({
  carousels: [],
  selectedDate: null,
  selectedCarousel: null,
  isGenerating: false,
  generationProgress: { current: 0, total: 0, status: '' },

  setCarousels: (carousels) => set({ carousels }),
  
  addCarousel: (carousel) =>
    set((state) => ({
      carousels: [...state.carousels, carousel],
    })),
  
  updateCarousel: (id, updates) =>
    set((state) => ({
      carousels: state.carousels.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
      selectedCarousel:
        state.selectedCarousel?.id === id
          ? { ...state.selectedCarousel, ...updates }
          : state.selectedCarousel,
    })),
  
  removeCarousel: (id) =>
    set((state) => ({
      carousels: state.carousels.filter((c) => c.id !== id),
      selectedCarousel:
        state.selectedCarousel?.id === id ? null : state.selectedCarousel,
    })),
  
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  setSelectedCarousel: (carousel) => set({ selectedCarousel: carousel }),
  
  setGenerating: (isGenerating) => set({ isGenerating }),
  
  setGenerationProgress: (progress) => set({ generationProgress: progress }),
}));

// =====================================
// Settings Store
// =====================================

interface SettingsState {
  settings: GenerationSettings;
  apiUsage: ApiUsageStats | null;
  
  // Actions
  setSettings: (settings: GenerationSettings) => void;
  updateSettings: (updates: Partial<GenerationSettings>) => void;
  setApiUsage: (usage: ApiUsageStats) => void;
}

const defaultSettings: GenerationSettings = {
  imageMode: 'stock',
  stockSource: 'both',
  brandVoiceStrictness: 70,
  imageStyle: 'epic cinematic',
  imageQuality: 'standard',
  themeCategories: [],
  excludedThemes: [],
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  apiUsage: null,

  setSettings: (settings) => set({ settings }),
  
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),
  
  setApiUsage: (apiUsage) => set({ apiUsage }),
}));

// =====================================
// UI Store
// =====================================

interface UIState {
  sidebarOpen: boolean;
  activeTab: 'dashboard' | 'library' | 'generate' | 'settings';
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: UIState['activeTab']) => void;
  addToast: (toast: Omit<UIState['toasts'][0], 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTab: 'dashboard',
  toasts: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `toast-${Date.now()}-${Math.random()}` },
      ],
    })),
  
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
