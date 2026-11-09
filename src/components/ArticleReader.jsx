import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  FileText,
  BookOpen,
  GraduationCap,
  Briefcase,
  Sparkles,
  Send,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

export default function ArticleReader({
  articleData,
  isLoading,
  onBack,
  onToggleBookmark,
  onSaveGlossaryConcept,
}) {
  // Strictly ONE view at a time: 'summary' | 'concept' | 'harvard' | 'firms'
  const [activeSection, setActiveSection] = useState('summary');
  // Concept view modes: 'brief' | 'advanced' | 'application' | 'example' | 'risks'
  const [conceptViewMode, setConceptViewMode] = useState('brief');
  const [conceptSaved, setConceptSaved] = useState(false);
  const [liveConcept, setLiveConcept] = useState(null);
  const [isIdentifyingConcept, setIsIdentifyingConcept] = useState(false);

  // Interactive Gemini Concept Chatbox state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);

  const article = articleData?.article;
  const analysis = articleData?.analysis;
  const progressiveLearning = articleData?.progressiveLearning;

  useEffect(() => {
    setActiveSection('summary');
    setConceptViewMode('brief');
    setConceptSaved(Boolean(progressiveLearning?.isPreviouslyStudied));
    setLiveConcept(null);
    setChatHistory([]);
    setChatInput('');
    const initialSuggestions = analysis?.conceptExplainer?.suggestedQuestions || [];
    setSuggestedQuestions(initialSuggestions);
  }, [article?.id, progressiveLearning?.isPreviouslyStudied, analysis?.conceptExplainer]);

  if (isLoading || !article || !analysis) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Loading article...
      </div>
    );
  }

  const overview = analysis.detailedOverview || {};
  const concept = liveConcept || analysis.conceptExplainer || {};
  const commercial = analysis.commercialImplications || {};
  const synergies = analysis.academicSynergies || {};
  const profConn = analysis.professorConnections || {};

  const conceptTitle = concept.conceptTerm || concept.term || 'Core Legal & Financial Concept';

  const handleOpenConceptTab = async () => {
    setActiveSection('concept');
    // Trigger on-demand Gemini concept identification if not yet enriched with articleApplication
    if (!liveConcept && (!concept.articleApplication || !concept.keyRisks)) {
      setIsIdentifyingConcept(true);
      try {
        const res = await fetch(`/api/articles/${article.id}/concept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRefresh: false }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.concept) {
            setLiveConcept(data.concept);
            if (Array.isArray(data.concept.suggestedQuestions) && data.concept.suggestedQuestions.length > 0) {
              setSuggestedQuestions(data.concept.suggestedQuestions);
            }
          }
        }
      } catch {
        // Fallback to existing concept gracefully
      } finally {
        setIsIdentifyingConcept(false);
      }
    }
  };

  const handleRefreshConceptWithGemini = async () => {
    setIsIdentifyingConcept(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/concept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.concept) {
          setLiveConcept(data.concept);
          if (Array.isArray(data.concept.suggestedQuestions) && data.concept.suggestedQuestions.length > 0) {
            setSuggestedQuestions(data.concept.suggestedQuestions);
          }
        }
      }
    } catch {
      // Keep current concept
    } finally {
      setIsIdentifyingConcept(false);
    }
  };

  const handleSaveConceptClick = async () => {
    await onSaveGlossaryConcept({
      term: conceptTitle,
      categoryId: concept.categoryId || article.categoryId,
      shortDefinition: concept.shortDefinition,
      beginner: concept.beginner,
      intermediate: concept.intermediate,
      advanced: concept.advanced,
      practicalExample: concept.practicalExample || concept.articleApplication,
      articleId: article.id,
      masteryLevel: 'familiar',
    });
    setConceptSaved(true);
  };

  const handleAskConceptQuestion = async (questionText) => {
    const q = String(questionText || chatInput || '').trim();
    if (!q || isChatLoading) return;

    const nextHistory = [...chatHistory, { role: 'user', text: q }];
    setChatHistory(nextHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`/api/articles/${article.id}/concept-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          history: chatHistory,
        }),
      });
      const data = await res.json();
      const replyText =
        data?.reply ||
        'Here is how this concept operates in practice: ' +
          (concept.intermediate || concept.beginner || '');
      setChatHistory([...nextHistory, { role: 'assistant', text: replyText }]);
      if (Array.isArray(data?.followUpSuggestions) && data.followUpSuggestions.length > 0) {
        setSuggestedQuestions(data.followUpSuggestions);
      }
    } catch {
      setChatHistory([
        ...nextHistory,
        {
          role: 'assistant',
          text:
            concept.intermediate ||
            concept.beginner ||
            'Unable to reach Gemini right now. Please try again.',
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const defaultQuestions =
    suggestedQuestions.length > 0
      ? suggestedQuestions
      : [
          `How does ${conceptTitle} apply specifically to this article?`,
          `Give me a more advanced breakdown of ${conceptTitle}.`,
          `What are the key legal and commercial risks here?`,
        ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Top Bar: Back, Save Article, Source Link */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-crimson-700 dark:text-crimson-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Briefs</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleBookmark(article.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              article.isBookmarked
                ? 'bg-crimson-700 text-white border-crimson-700'
                : 'bg-white dark:bg-ink-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-800'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${article.isBookmarked ? 'fill-current' : ''}`} />
            <span>{article.isBookmarked ? 'Article Saved' : 'Save Article'}</span>
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900"
          >
            <span>Original Article</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Headline & Source */}
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
          {article.sourceName} •{' '}
          {new Date(article.publishedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
          {article.title}
        </h1>
      </div>

      {/* 4 Simple Buttons — Tap to Switch Between One View at a Time */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => setActiveSection('summary')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
            activeSection === 'summary'
              ? 'bg-crimson-700 text-white border-crimson-700 shadow-xs'
              : 'bg-white dark:bg-ink-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>1. Article</span>
        </button>

        <button
          onClick={handleOpenConceptTab}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
            activeSection === 'concept'
              ? 'bg-crimson-700 text-white border-crimson-700 shadow-xs'
              : 'bg-white dark:bg-ink-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>2. Concept</span>
        </button>

        <button
          onClick={() => setActiveSection('harvard')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
            activeSection === 'harvard'
              ? 'bg-crimson-700 text-white border-crimson-700 shadow-xs'
              : 'bg-white dark:bg-ink-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-800'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>3. Harvard Law</span>
        </button>

        <button
          onClick={() => setActiveSection('firms')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
            activeSection === 'firms'
              ? 'bg-crimson-700 text-white border-crimson-700 shadow-xs'
              : 'bg-white dark:bg-ink-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-slate-800'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>4. Law Firms</span>
        </button>
      </div>

      {/* SINGLE ACTIVE CARD — Shows ONLY the 1 button you clicked */}
      <div className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-ink-900 p-5 sm:p-6 shadow-xs">
        {/* VIEW 1: THE ARTICLE SUMMARY (Informative Headline + 2-4 Coherent Paragraphs ~200 words) */}
        {activeSection === 'summary' && (
          <div className="space-y-4">
            {overview.summaryHeadline &&
              overview.summaryHeadline.toLowerCase() !== article.title.toLowerCase() && (
                <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-white border-b border-stone-100 dark:border-slate-800 pb-2.5">
                  {overview.summaryHeadline}
                </h2>
              )}

            <div className="rounded-xl bg-parchment-100 dark:bg-ink-950 border-l-4 border-crimson-700 p-3.5">
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                <strong className="text-crimson-800 dark:text-crimson-400">Key Takeaway: </strong>
                {analysis.whyThisMatters || article.whyThisMatters}
              </p>
            </div>

            <div className="space-y-3.5 font-serif text-base text-slate-800 dark:text-slate-200 leading-relaxed">
              {(overview.narrative || []).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {overview.practiceNote && (
              <div className="pt-3 border-t border-stone-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {overview.practiceNote}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: PERSONALIZED ARTICLE CONCEPT EXPLORER + INTERACTIVE GEMINI CHATBOX */}
        {activeSection === 'concept' && (
          <div className="space-y-5">
            {/* Header: Personalized Concept Term + Save / Refresh Controls */}
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-crimson-700 dark:text-crimson-400">
                    <Sparkles className="w-3 h-3" />
                    Core Concept in This Article
                  </span>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {conceptTitle}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleRefreshConceptWithGemini}
                    disabled={isIdentifyingConcept}
                    title="Re-analyze concept from article summary"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-parchment-100 dark:hover:bg-ink-950 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isIdentifyingConcept ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleSaveConceptClick}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      conceptSaved
                        ? 'bg-crimson-700 text-white border-crimson-700'
                        : 'bg-parchment-50 dark:bg-ink-950 text-crimson-700 dark:text-crimson-400 border-crimson-300 dark:border-crimson-800 hover:bg-crimson-50'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${conceptSaved ? 'fill-current' : ''}`} />
                    <span>{conceptSaved ? 'Saved ✓' : 'Save Concept'}</span>
                  </button>
                </div>
              </div>

              {concept.shortDefinition && (
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-parchment-50 dark:bg-ink-950 px-3.5 py-2.5 rounded-xl border border-stone-200/80 dark:border-slate-800">
                  {concept.shortDefinition}
                </p>
              )}

              {/* Interactive Exploration Option Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'brief', label: 'Concept Brief' },
                  { id: 'advanced', label: 'More Advanced' },
                  { id: 'application', label: 'How It Applies Here' },
                  { id: 'example', label: 'Real-World Example' },
                  { id: 'risks', label: 'Key Risks' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setConceptViewMode(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      conceptViewMode === tab.id
                        ? 'bg-crimson-700 text-white border-crimson-700 shadow-2xs'
                        : 'bg-white dark:bg-ink-950 text-slate-700 dark:text-slate-300 border-stone-200 dark:border-slate-800 hover:border-crimson-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Concept Explanation Panel */}
            <div className="p-4 rounded-xl bg-parchment-50/70 dark:bg-ink-950 border border-stone-200 dark:border-slate-800 space-y-3 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              {conceptViewMode === 'brief' && (
                <>
                  <p>{concept.beginner}</p>
                  {concept.articleApplication && (
                    <div className="pt-2.5 border-t border-stone-200/70 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <strong className="text-crimson-800 dark:text-crimson-400">
                        In this article:{' '}
                      </strong>
                      {concept.articleApplication}
                    </div>
                  )}
                </>
              )}

              {conceptViewMode === 'advanced' && (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400 block mb-1">
                      Intermediate Legal & Commercial Mechanics
                    </span>
                    <p>{concept.intermediate}</p>
                  </div>
                  {concept.advanced && (
                    <div className="pt-2.5 border-t border-stone-200/70 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400 block mb-1">
                        Advanced Doctrinal & Structuring Nuance
                      </span>
                      <p>{concept.advanced}</p>
                    </div>
                  )}
                </div>
              )}

              {conceptViewMode === 'application' && (
                <div>
                  <span className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400 block mb-1">
                    Direct Application to "{article.title}"
                  </span>
                  <p>{concept.articleApplication || concept.practicalExample || concept.intermediate}</p>
                </div>
              )}

              {conceptViewMode === 'example' && (
                <div>
                  <span className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400 block mb-1">
                    Practical Law Firm & Market Example
                  </span>
                  <p>{concept.practicalExample || concept.articleApplication}</p>
                </div>
              )}

              {conceptViewMode === 'risks' && (
                <div>
                  <span className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400 block mb-1">
                    Key Legal, Regulatory & Commercial Risks
                  </span>
                  <p>{concept.keyRisks || concept.advanced || concept.intermediate}</p>
                </div>
              )}
            </div>

            {/* INTERACTIVE GEMINI CONCEPT CHATBOX */}
            <div className="pt-4 border-t border-stone-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  <MessageSquare className="w-3.5 h-3.5 text-crimson-700 dark:text-crimson-400" />
                  Ask Gemini About This Concept
                </span>
                <span className="text-[11px] text-slate-400">
                  Interactive Concept Q&A
                </span>
              </div>

              {/* One-tap Quick Question Pills */}
              <div className="flex flex-wrap gap-1.5">
                {defaultQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAskConceptQuestion(q)}
                    disabled={isChatLoading}
                    className="text-left text-xs px-3 py-1.5 rounded-full bg-parchment-100 dark:bg-ink-950 text-slate-700 dark:text-slate-300 hover:bg-crimson-50 dark:hover:bg-crimson-950/40 hover:text-crimson-800 dark:hover:text-crimson-300 border border-stone-200 dark:border-slate-800 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Chat Message Thread */}
              {chatHistory.length > 0 && (
                <div className="space-y-2.5 max-h-80 overflow-y-auto p-3 rounded-xl bg-stone-50 dark:bg-ink-950 border border-stone-200 dark:border-slate-800">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-crimson-700 text-white ml-6'
                          : 'bg-white dark:bg-ink-900 text-slate-800 dark:text-slate-200 border border-stone-200 dark:border-slate-800 mr-4'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="p-3 rounded-xl text-xs text-slate-500 bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 mr-4">
                      Gemini is analyzing the concept...
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskConceptQuestion(chatInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask a question about ${conceptTitle}...`}
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs sm:text-sm bg-parchment-50 dark:bg-ink-950 border border-stone-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-crimson-600"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-crimson-700 text-white hover:bg-crimson-800 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 3: HARVARD LAW & PROFESSOR CONNECTION */}
        {activeSection === 'harvard' && (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400">
                Relevant Harvard Professor
              </span>
              <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {profConn.verifiedProfessor}
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed">
                {profConn.scholarshipContext}
              </p>
            </div>

            {(synergies.hlsCourses || []).length > 0 && (
              <div className="pt-3 border-t border-stone-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Matching Harvard Law Courses
                </span>
                {synergies.hlsCourses.map((course, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-parchment-50 dark:bg-ink-950 text-xs sm:text-sm"
                  >
                    <strong className="text-slate-900 dark:text-white">{course.title}: </strong>
                    <span className="text-slate-600 dark:text-slate-300">{course.connection}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: LAW FIRMS & COMMERCIAL IMPACT */}
        {activeSection === 'firms' && (
          <div className="space-y-4">
            {article.matchedFirms?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {article.matchedFirms.map((firm) => (
                  <span
                    key={firm.id}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-crimson-50 dark:bg-crimson-950 text-crimson-800 dark:text-crimson-200"
                  >
                    {firm.name}
                  </span>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase text-crimson-700 dark:text-crimson-400 mb-1">
                What the Law Firms Do
              </h3>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {commercial.lawFirmAdvisoryRole}
              </p>
            </div>

            <div className="pt-3 border-t border-stone-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">
                Business Rationale
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {commercial.businessRationale}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
