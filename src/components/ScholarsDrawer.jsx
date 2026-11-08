import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Bookmark,
  BookMarked,
  Sparkles,
  Trash2,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
  StickyNote,
} from 'lucide-react';

export default function ScholarsDrawer({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  allArticles = [],
  glossary = [],
  notes = [],
  weeklyDigest,
  isGeneratingDigest,
  onRegenerateDigest,
  onSelectArticle,
  onUpdateGlossaryMastery,
  onDeleteGlossaryConcept,
  onAddNote,
  onDeleteNote,
}) {
  const [selectedGlossaryDepth, setSelectedGlossaryDepth] = useState({});
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState('academic_question');

  if (!isOpen) return null;

  const bookmarkedArticles = allArticles.filter((a) => a.isBookmarked);
  const readHistoryArticles = allArticles.filter((a) => a.readStatus === 'read');

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    await onAddNote({
      title: newNoteTitle.trim(),
      noteType: newNoteType,
      content: newNoteContent.trim(),
      tags: ['HLS LL.M. Notebook'],
    });
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-parchment-50 dark:bg-ink-950 h-full shadow-2xl border-l border-stone-200 dark:border-slate-800 flex flex-col">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-crimson-800 dark:bg-crimson-950 text-white flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold">
              Scholar’s Workspace &amp; LL.M. Research Suite
            </h2>
            <p className="text-xs text-crimson-200">
              Persistent SQLite storage for Bookmarks, Research Notes, Progressive Glossary &amp; Weekly Digests
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-crimson-700 text-crimson-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Streamlined Tabs */}
        <div className="grid grid-cols-3 border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-ink-900 px-4 pt-2">
          <button
            onClick={() => onTabChange('notebook')}
            className={`py-2.5 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'notebook'
                ? 'border-crimson-700 text-crimson-700 dark:text-crimson-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Library &amp; Notebook ({bookmarkedArticles.length + notes.length})</span>
          </button>

          <button
            onClick={() => onTabChange('glossary')}
            className={`py-2.5 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'glossary'
                ? 'border-crimson-700 text-crimson-700 dark:text-crimson-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Personal Glossary ({glossary.length})</span>
          </button>

          <button
            onClick={() => onTabChange('digest')}
            className={`py-2.5 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'digest'
                ? 'border-crimson-700 text-crimson-700 dark:text-crimson-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Weekly Digest</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: READING LIBRARY & RESEARCH NOTEBOOK */}
          {activeTab === 'notebook' && (
            <>
              {/* Bookmarks Section */}
              <div className="space-y-3">
                <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-crimson-700 dark:text-crimson-400" />
                  <span>Bookmarked Articles ({bookmarkedArticles.length})</span>
                </h3>
                {bookmarkedArticles.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No bookmarked articles yet. Click the bookmark icon on any brief to save it here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bookmarkedArticles.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => {
                          onSelectArticle(art.id);
                          onClose();
                        }}
                        className="p-3 rounded-lg bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 hover:border-crimson-700 cursor-pointer"
                      >
                        <div className="text-[10px] font-mono text-crimson-700 dark:text-crimson-400 uppercase">
                          {art.categoryId} • {art.sourceName}
                        </div>
                        <p className="font-serif text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                          {art.title}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Research Notebook Section */}
              <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-slate-800">
                <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-crimson-700 dark:text-crimson-400" />
                  <span>LL.M. Research Notebook ({notes.length})</span>
                </h3>

                <form
                  onSubmit={handleNoteSubmit}
                  className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      placeholder="New research note or seminar question title..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
                    />
                    <select
                      value={newNoteType}
                      onChange={(e) => setNewNoteType(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
                    >
                      <option value="academic_question">Academic Question</option>
                      <option value="firm_insight">Firm / Deal Insight</option>
                      <option value="personal_note">Personal Note</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Write academic synthesis, HLS course connection, or deal observation..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-crimson-700 text-white hover:bg-crimson-800"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                </form>

                <div className="space-y-2.5">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-crimson-50 dark:bg-crimson-950 text-crimson-800 dark:text-crimson-200">
                          {n.noteType.replace('_', ' ')}
                        </span>
                        <button
                          onClick={() => onDeleteNote(n.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h4 className="font-serif font-bold text-sm text-slate-900 dark:text-white">
                        {n.title}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {n.content}
                      </p>
                      {n.articleId && (
                        <button
                          onClick={() => {
                            onSelectArticle(n.articleId);
                            onClose();
                          }}
                          className="text-[11px] font-semibold text-crimson-700 dark:text-crimson-400 hover:underline pt-1 inline-block"
                        >
                          Open Linked Article &rarr;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reading History */}
              <div className="space-y-2 pt-4 border-t border-stone-200 dark:border-slate-800">
                <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Reading History ({readHistoryArticles.length} Read)</span>
                </h3>
                <div className="space-y-1.5">
                  {readHistoryArticles.slice(0, 8).map((art) => (
                    <div
                      key={art.id}
                      onClick={() => {
                        onSelectArticle(art.id);
                        onClose();
                      }}
                      className="p-2.5 rounded-lg bg-white/70 dark:bg-ink-900/70 border border-stone-200/70 dark:border-slate-800 text-xs flex items-center justify-between gap-2 cursor-pointer hover:border-crimson-700"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {art.title}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {art.categoryId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: PERSONAL GLOSSARY & PROGRESSIVE LEARNING */}
          {activeTab === 'glossary' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800">
                <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">
                  Progressive Legal &amp; Financial Concept Glossary
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Concepts saved here are recognized automatically when they appear in future articles, defaulting the Concept Explainer to Intermediate or Advanced depth.
                </p>
              </div>

              {glossary.map((item) => {
                const depth = selectedGlossaryDepth[item.id] || 'intermediate';
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-crimson-700 dark:text-crimson-400 font-semibold">
                          {item.categoryId} • Encountered {item.encounterCount}x
                        </span>
                        <h4 className="font-serif text-base font-bold text-slate-900 dark:text-white">
                          {item.term}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.masteryLevel}
                          onChange={(e) => onUpdateGlossaryMastery(item.id, e.target.value)}
                          className="text-[11px] font-mono px-2 py-1 rounded border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
                        >
                          <option value="new">Mastery: New</option>
                          <option value="familiar">Mastery: Familiar</option>
                          <option value="mastered">Mastery: Mastered</option>
                        </select>
                        <button
                          onClick={() => onDeleteGlossaryConcept(item.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="Remove from glossary"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      {item.shortDefinition}
                    </p>

                    <div className="flex gap-1">
                      {['beginner', 'intermediate', 'advanced'].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() =>
                            setSelectedGlossaryDepth((prev) => ({ ...prev, [item.id]: lvl }))
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize ${
                            depth === lvl
                              ? 'bg-crimson-700 text-white'
                              : 'bg-parchment-100 dark:bg-ink-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed bg-parchment-50 dark:bg-ink-950 p-3 rounded-lg border border-stone-200/80 dark:border-slate-800">
                      {item[depth] || item.intermediate || item.beginner}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: WEEKLY INTELLIGENCE DIGEST */}
          {activeTab === 'digest' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-crimson-700 dark:text-crimson-400 font-semibold">
                    {weeklyDigest?.weekLabel || 'Weekly Synthesis'}
                  </span>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                    Weekly Legal &amp; Commercial Intelligence Digest
                  </h3>
                </div>
                <button
                  onClick={onRegenerateDigest}
                  disabled={isGeneratingDigest}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-crimson-700 text-white hover:bg-crimson-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingDigest ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingDigest ? 'Synthesizing...' : 'Refresh Digest'}</span>
                </button>
              </div>

              {weeklyDigest?.digest && (
                <>
                  <div className="p-4 rounded-xl bg-crimson-50/60 dark:bg-crimson-950/30 border border-crimson-200 dark:border-crimson-900">
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {weeklyDigest.digest.headlineSummary}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500">
                      Key Developments by Practice Theme
                    </h4>
                    {(weeklyDigest.digest.keyDevelopmentsByTheme || []).map((t, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-2"
                      >
                        <h5 className="font-serif font-bold text-sm text-slate-900 dark:text-white">
                          {t.theme}
                        </h5>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {t.synthesis}
                        </p>
                      </div>
                    ))}
                  </div>

                  {(weeklyDigest.digest.conceptMasteryReview || []).length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500">
                        Progressive Learning Concept Review
                      </h4>
                      {weeklyDigest.digest.conceptMasteryReview.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800"
                        >
                          <div className="font-serif font-bold text-xs text-crimson-700 dark:text-crimson-400">
                            {c.term}
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                            {c.synthesisQuestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
