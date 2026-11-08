import React from 'react';
import {
  Scale,
  Search,
  RefreshCw,
  Bookmark,
  Sun,
  Moon,
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
  darkMode,
  onToggleDarkMode,
}) {
  const bookmarkedCount = stats?.bookmarkedCount || 0;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-slate-800 bg-parchment-50/95 dark:bg-ink-950/95 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo — Always returns to the 7 Topics Home Screen */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 text-left focus:outline-none shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-crimson-700 text-white flex items-center justify-center">
            <Scale className="w-4 h-4" />
          </div>
          <span className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            CrimsonBrief
          </span>
        </button>

        {/* Simple Search Box */}
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

        {/* Only 3 Simple Action Buttons: Saved, Refresh, Theme */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onOpenDrawer('notebook')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
            title="Saved Bookmarks"
          >
            <Bookmark className="w-3.5 h-3.5 text-crimson-700 dark:text-crimson-400" />
            <span className="hidden sm:inline">Saved</span>
            {bookmarkedCount > 0 && <span>({bookmarkedCount})</span>}
          </button>

          <button
            onClick={onTriggerRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-crimson-700 hover:bg-crimson-800 text-white disabled:opacity-50"
            title="Refresh News"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? '...' : 'Refresh'}</span>
          </button>

          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-stone-200/60 dark:hover:bg-slate-800"
            title="Light / Dark Mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
