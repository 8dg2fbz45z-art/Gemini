import React from 'react';
import {
  Building2,
  Landmark,
  TrendingUp,
  Briefcase,
  Cpu,
  Layers,
  Globe,
  GraduationCap,
  Scale,
  Flame,
  ChevronRight,
} from 'lucide-react';

const ICON_MAP = {
  Building2,
  Landmark,
  TrendingUp,
  Briefcase,
  Cpu,
  Layers,
  Globe,
};

export default function DashboardGrid({
  categories = [],
  spotlight,
  maxBriefsPerTopic = 15,
  onSelectCategory,
  onSelectArticle,
  onSelectFacultySpotlight,
  onSelectLawFirmInsight,
}) {
  const storyOfTheDay = spotlight?.storyOfTheDay;
  const biggestCategory = spotlight?.biggestCategory;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* DAILY SPOTLIGHT BOX: #1 Biggest Story of the Day & Biggest Category by Score */}
      {storyOfTheDay && (
        <div className="rounded-2xl border-2 border-crimson-700 bg-white dark:bg-ink-900 p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-crimson-700 text-white">
              <Flame className="w-3.5 h-3.5" />
              <span>Spotlight • #1 Story of the Day (Score {storyOfTheDay.significanceScore}/100)</span>
            </div>

            {biggestCategory && (
              <button
                onClick={() => onSelectCategory(biggestCategory.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-parchment-100 dark:bg-ink-800 text-crimson-800 dark:text-crimson-300 border border-stone-200 dark:border-slate-700 hover:border-crimson-700"
              >
                <span>Top Category Today: {biggestCategory.name}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div
            onClick={() => onSelectArticle(storyOfTheDay.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectArticle(storyOfTheDay.id);
            }}
            className="group cursor-pointer space-y-1.5 pt-1"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {storyOfTheDay.sourceName}
            </div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-white group-hover:text-crimson-700 dark:group-hover:text-crimson-400 leading-snug">
              {storyOfTheDay.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
              {storyOfTheDay.whyThisMatters || storyOfTheDay.summary}
            </p>
            <div className="pt-1 text-xs font-semibold text-crimson-700 dark:text-crimson-400 group-hover:underline">
              Tap to read #1 story &rarr;
            </div>
          </div>
        </div>
      )}

      {/* Direct-Access Insight Boxes: Harvard Insight & Law Firm Insight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          onClick={onSelectFacultySpotlight}
          className="group text-left rounded-2xl border-2 border-crimson-700/30 dark:border-crimson-500/40 bg-crimson-50/50 dark:bg-crimson-950/30 p-5 shadow-xs hover:border-crimson-700 transition-all flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-crimson-700 flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-crimson-700 dark:group-hover:text-crimson-400 truncate">
                Harvard Insight
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                Harvard Law professor articles &amp; research
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-crimson-700 dark:text-crimson-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>

        <button
          onClick={onSelectLawFirmInsight}
          className="group text-left rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-stone-100/70 dark:bg-ink-900 p-5 shadow-xs hover:border-crimson-700 transition-all flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center text-white shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-crimson-700 dark:group-hover:text-crimson-400 truncate">
                Law Firm Insight
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                Vault 10 &amp; AmLaw 50 deals &amp; activity
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-crimson-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </div>

      {/* The 7 Core Sector Topic Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {categories.map((cat) => {
          const IconComponent = ICON_MAP[cat.icon] || Building2;
          const count = Math.min(maxBriefsPerTopic, cat.totalCount || 0);

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group text-left rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-ink-900 p-5 shadow-xs hover:border-crimson-700 transition-all flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: cat.accentColor || '#A51C30' }}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-crimson-700 dark:group-hover:text-crimson-400 truncate">
                    {cat.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {count} daily briefs
                  </p>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-crimson-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
