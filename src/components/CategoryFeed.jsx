import React from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';

export default function CategoryFeed({
  categories = [],
  lawFirms = [],
  selectedCategoryId,
  selectedFirmId,
  facultyOnly,
  watchedFirmsOnly,
  searchQuery,
  articles = [],
  maxBriefsPerTopic = 8,
  isLoading,
  onBackToGrid,
  onSelectFirm,
  onSelectArticle,
  onToggleBookmark,
}) {
  const activeCategory = categories.find((c) => c.id === selectedCategoryId) || null;
  const activeFirm = lawFirms.find((f) => f.id === selectedFirmId) || null;
  const watchedFirms = lawFirms.filter((f) => f.isWatched);
  const hardLimit = Math.min(8, Math.max(6, Number(maxBriefsPerTopic) || 8));
  const visibleArticles = articles.slice(0, hardLimit);

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getFeedTitle = () => {
    if (searchQuery && searchQuery.trim()) return `Search: “${searchQuery.trim()}”`;
    if (facultyOnly) return 'Harvard Insight';
    if (watchedFirmsOnly || activeFirm) {
      return activeFirm ? `Law Firm Insight: ${activeFirm.shortName}` : 'Law Firm Insight';
    }
    if (activeCategory) return activeCategory.name;
    return 'Daily Briefs';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Simple Back Button */}
      <button
        onClick={onBackToGrid}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-crimson-700 dark:text-crimson-400 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {/* Topic Title */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {getFeedTitle()}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {visibleArticles.length} briefs • Ranked by Importance Score (#1 Highest on top) • Unread stories stay until read
        </p>
      </div>

      {/* When inside Law Firm Insight, show simple firm filter pills */}
      {(watchedFirmsOnly || activeFirm) && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => onSelectFirm(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
              !selectedFirmId
                ? 'bg-crimson-700 text-white'
                : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-800'
            }`}
          >
            All Top Firms
          </button>
          {watchedFirms.map((firm) => (
            <button
              key={firm.id}
              onClick={() => onSelectFirm(firm.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                selectedFirmId === firm.id
                  ? 'bg-crimson-700 text-white'
                  : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-800'
              }`}
            >
              {firm.shortName}
            </button>
          ))}
        </div>
      )}

      {/* Simple, Lightweight Vertical Scroll */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading briefs...</div>
      ) : visibleArticles.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-ink-900 text-sm text-slate-500">
          No briefs found for this selection.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleArticles.map((article, idx) => {
            const isRead = article.readStatus === 'read';
            return (
              <div
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectArticle(article.id);
                }}
                className={`group rounded-2xl border bg-white dark:bg-ink-900 p-4 sm:p-5 shadow-xs hover:border-crimson-700 transition-all cursor-pointer ${
                  isRead
                    ? 'border-stone-200/80 dark:border-slate-800/80 opacity-85'
                    : 'border-stone-200 dark:border-slate-800'
                }`}
              >
                {/* Rank + Score + Unread/Read Status + Source + Date + Bookmark */}
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-parchment-100 dark:bg-ink-800 text-crimson-800 dark:text-crimson-300">
                      #{idx + 1} • Score {article.significanceScore}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        isRead
                          ? 'bg-stone-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          : 'bg-crimson-50 dark:bg-crimson-950/60 text-crimson-700 dark:text-crimson-300'
                      }`}
                    >
                      {isRead ? 'Read ✓' : 'Unread'}
                    </span>
                    <span>
                      {article.sourceName} • {formatDate(article.publishedAt)}
                    </span>
                    {article.matchedFirms?.length > 0 && (
                      <span className="text-crimson-700 dark:text-crimson-400 font-medium">
                        • {article.matchedFirms.map((f) => f.shortName).join(', ')}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(article.id);
                    }}
                    className={`p-1 rounded ${
                      article.isBookmarked
                        ? 'text-crimson-700 dark:text-crimson-400'
                        : 'text-slate-300 hover:text-slate-600'
                    }`}
                    aria-label="Save brief"
                  >
                    <Bookmark className={`w-4 h-4 ${article.isBookmarked ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Headline */}
                <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-crimson-700 dark:group-hover:text-crimson-400 leading-snug">
                  {article.title}
                </h2>

                {/* Short 2-line preview only */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                  {article.summary}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
