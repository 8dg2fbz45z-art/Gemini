import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, Rss } from 'lucide-react';

export default function GeminiSettingsModal({
  isOpen,
  onClose,
  aiStatus,
  publicRssSources = [],
  onSaveGeminiSettings,
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(aiStatus?.model || 'gemini-2.5-pro');
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
      <div className="w-full max-w-2xl rounded-2xl bg-parchment-50 dark:bg-ink-950 border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-crimson-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="font-serif text-lg font-bold">
                Google Gemini AI &amp; Verified Feed Configuration
              </h2>
              <p className="text-xs text-crimson-200">
                Smart SQLite caching ensures unchanged articles are never processed twice
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-crimson-700 text-crimson-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Google Gemini API Key (Stored Locally in SQLite `crimsonbrief.sqlite`)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  aiStatus?.hasApiKey
                    ? '•••••••••••••••••••••••• (API Key Active — enter new key to replace)'
                    : 'Paste your GEMINI_API_KEY (AIzaSy...)'
                }
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-ink-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Without an active key, CrimsonBrief remains 100% functional using pre-verified cached analyses and deterministic registry synthesis.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Preferred Gemini Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-ink-900"
              >
                <option value="gemini-2.5-pro">
                  gemini-2.5-pro (Default — Deep Doctrinal &amp; Transactional Reasoning)
                </option>
                <option value="gemini-2.5-flash">
                  gemini-2.5-flash (High-Speed Structured Legal Analysis)
                </option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-crimson-700 hover:bg-crimson-800 text-white"
              >
                Save Gemini Configuration
              </button>
              {savedNotice && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved to SQLite</span>
                </span>
              )}
            </div>
          </form>

          {/* Verified Public RSS Sources List */}
          <div className="pt-4 border-t border-stone-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Rss className="w-4 h-4 text-crimson-700" />
              <span>Active Verified Public RSS &amp; Regulatory Sources</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Automatic daily refresh runs at 07:00 while the local server is running, or anytime via the &ldquo;Refresh Live News&rdquo; button.
            </p>
            <div className="space-y-1.5">
              {publicRssSources.map((src) => (
                <div
                  key={src.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {src.name}
                    </span>
                    <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {src.sourceType.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    Weight: {src.credibilityWeight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
