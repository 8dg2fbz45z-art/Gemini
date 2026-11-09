import React, { useState } from 'react';
import {
  X,
  Settings,
  Type,
  Eye,
  Sparkles,
  CheckCircle2,
  Rss,
} from 'lucide-react';

export default function GeminiSettingsModal({
  isOpen,
  onClose,
  aiStatus,
  publicRssSources = [],
  onSaveGeminiSettings,
  uiSettings,
  onUpdateUiSettings,
  darkMode,
  onToggleDarkMode,
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(aiStatus?.model || 'gemini-2.5-flash');
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSaveGeminiSettings({ apiKey, model });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-parchment-50 dark:bg-ink-950 border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-crimson-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-crimson-200" />
            <div>
              <h2 className="font-serif text-lg font-bold">
                Settings, Accessibility &amp; AI Monitor
              </h2>
              <p className="text-xs text-crimson-200">
                Customize reading comfort, font size, accessibility, and AI settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-crimson-700 text-crimson-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* 1. Font & Typography Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crimson-700 dark:text-crimson-400">
              <Type className="w-4 h-4" />
              <span>1. Font &amp; Reading Size</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Text Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: 'Normal (100%)' },
                    { id: 'large', label: 'Large (112%)' },
                    { id: 'xlarge', label: 'Extra Large (125%)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateUiSettings({ fontSize: opt.id })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                        uiSettings.fontSize === opt.id
                          ? 'bg-crimson-700 text-white border-crimson-700'
                          : 'bg-parchment-50 dark:bg-ink-950 text-slate-700 dark:text-slate-300 border-stone-200 dark:border-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Font Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'editorial', label: 'Editorial Serif (Harvard Style)' },
                    { id: 'sans', label: 'Clean Sans-Serif (Modern)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateUiSettings({ fontFamily: opt.id })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                        uiSettings.fontFamily === opt.id
                          ? 'bg-crimson-700 text-white border-crimson-700'
                          : 'bg-parchment-50 dark:bg-ink-950 text-slate-700 dark:text-slate-300 border-stone-200 dark:border-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Accessibility & Feed Limit */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crimson-700 dark:text-crimson-400">
              <Eye className="w-4 h-4" />
              <span>2. Accessibility &amp; Display Preferences</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Accessibility Mode (High Contrast &amp; Relaxed Spacing)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Increases line height, contrast, and button tap targets
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={uiSettings.accessibilityMode}
                  onChange={(e) =>
                    onUpdateUiSettings({ accessibilityMode: e.target.checked })
                  }
                  className="w-4 h-4 rounded accent-crimson-700"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-stone-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Dark Mode
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Switch between warm parchment light mode and dark slate
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={onToggleDarkMode}
                  className="w-4 h-4 rounded accent-crimson-700"
                />
              </label>

              <div className="pt-2 border-t border-stone-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">
                  Daily Briefs per Topic Cap (6–8 Hard Limit)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[6, 7, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onUpdateUiSettings({ maxBriefsPerTopic: num })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                        uiSettings.maxBriefsPerTopic === num
                          ? 'bg-crimson-700 text-white border-crimson-700'
                          : 'bg-parchment-50 dark:bg-ink-950 text-slate-700 dark:text-slate-300 border-stone-200 dark:border-slate-800'
                      }`}
                    >
                      {num} Briefs
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. AI Model & Optional API Key */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-crimson-700 dark:text-crimson-400">
              <Sparkles className="w-4 h-4" />
              <span>3. AI Model &amp; Optional API Key</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Active AI Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-slate-700"
                >
                  <option value="gemini-2.5-flash">
                    gemini-2.5-flash (Default — Fast &amp; Token-Efficient)
                  </option>
                  <option value="gemini-2.5-pro">
                    gemini-2.5-pro (Deep Legal &amp; Commercial Reasoning)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Google Gemini API Key (Optional)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    aiStatus?.hasApiKey
                      ? 'API Key Active (Leave blank & save to clear)'
                      : 'Optional — App works 100% free without a key'
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-crimson-700 hover:bg-crimson-800 text-white"
                >
                  Save AI Settings
                </button>
                {savedNotice && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved</span>
                  </span>
                )}
              </div>
            </div>
          </form>

          {/* 4. System & Live Feed Monitor */}
          <div className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Rss className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Official News &amp; Regulatory RSS Feeds: {publicRssSources.length} (100% Real Articles)</span>
              </span>
              <span className="text-slate-500">
                Auto-refresh: Every 6 hours
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Open Sources: US SEC, Federal Reserve, SEBI, EC Competition, CNBC, Associated Press, Reuters, The Guardian, TechCrunch, Finshots, MediaNama, Rest of World, Lawfare, Tech Policy Press, Tax Foundation, JURIST, Mondaq, The Hindu, The Indian Express &amp; Yahoo News (Paywalled sources excluded; Harvard blog kept tertiary).
            </p>
            <p className="text-[11px] text-slate-500">
              Last Synced:{' '}
              {aiStatus?.lastRssRefresh
                ? new Date(aiStatus.lastRssRefresh).toLocaleString()
                : 'Ready'}
              {' • '}
              Database:{' '}
              {aiStatus?.tursoConnected
                ? 'Turso Cloud SQLite (Permanent Cloud Storage)'
                : 'Local SQLite (Ready for Turso Env Vars)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
