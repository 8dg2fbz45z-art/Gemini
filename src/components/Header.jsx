import React from 'react';
import {
  Scale,
  Search,
  RefreshCw,
  Bookmark,
  Sun,
  Moon,
  Home,
  Settings,
  X,
} from 'lucide-react';

export default function Header({
  onNavigateHome,
  searchQuery,
  onSearchChange,
  onTriggerRefresh,
  isRefreshing,
  stats,
  onOpenDrawer,
  onOpenGeminiSettings,
  darkMode,
  onToggleDarkMode,
}) {
  const savedCount = (stats?.bookmarkedCount || 0) + (stats?.glossaryCount || 0);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-slate-800 bg-parchment-50/95 dark:bg-ink-950/95 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2 sm:gap-3">
        {/* Logo */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-left focus:outline-none shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-crimson-700 text-white flex items-center justify-center">
            <Scale className="w-4 h-4" />
          </div>
          <span className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-white hidden xs:inline">
            CrimsonBrief
          </span>
        </button>

        {/* Search Box */}
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-7 py-1.5 text-sm rounded-full border border-stone-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-crimson-700"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons: Saved, Refresh, Settings, Dark Mode, and Go to Home */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onOpenDrawer('glossary')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-crimson-700"
            title="Saved Articles & Concepts"
          >
            <Bookmark className="w-3.5 h-3.5 text-crimson-700 dark:text-crimson-400" />
            <span className="hidden sm:inline">Saved</span>
            {savedCount > 0 && <span>({savedCount})</span>}
          </button>

          <button
            onClick={onTriggerRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-crimson-700 hover:bg-crimson-800 text-white disabled:opacity-50"
            title="Refresh News"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? '...' : 'Refresh'}</span>
          </button>

          <button
            onClick={onOpenGeminiSettings}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-crimson-700"
            title="Settings, Font, Accessibility & AI Model"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span className="hidden md:inline">Settings</span>
          </button>

          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-lg bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-crimson-700"
            title="Light / Dark Mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Dedicated Go To Home Button right next to Dark Mode */}
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90"
            title="Go straight to Home Screen"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
        </div>
      </div>
    </header>
  );
}
