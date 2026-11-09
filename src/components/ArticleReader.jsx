import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  FileText,
  BookOpen,
  GraduationCap,
  Briefcase,
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
  const [conceptDepth, setConceptDepth] = useState('beginner');
  const [conceptSaved, setConceptSaved] = useState(false);

  const article = articleData?.article;
  const analysis = articleData?.analysis;
  const progressiveLearning = articleData?.progressiveLearning;

  useEffect(() => {
    setActiveSection('summary');
    setConceptDepth('beginner');
    setConceptSaved(Boolean(progressiveLearning?.isPreviouslyStudied));
  }, [article?.id, progressiveLearning?.isPreviouslyStudied]);

  if (isLoading || !article || !analysis) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Loading article...
      </div>
    );
  }

  const overview = analysis.detailedOverview || {};
  const concept = analysis.conceptExplainer || {};
  const commercial = analysis.commercialImplications || {};
  const synergies = analysis.academicSynergies || {};
  const profConn = analysis.professorConnections || {};

  const handleSaveConceptClick = async () => {
    await onSaveGlossaryConcept({
      term: concept.conceptTerm,
      categoryId: concept.categoryId || article.categoryId,
      shortDefinition: concept.shortDefinition,
      beginner: concept.beginner,
      intermediate: concept.intermediate,
      advanced: concept.advanced,
      practicalExample: concept.practicalExample,
      articleId: article.id,
      masteryLevel: 'familiar',
    });
    setConceptSaved(true);
  };

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

      {/* Headline Only */}
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
          onClick={() => setActiveSection('concept')}
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
        {/* VIEW 1: THE ARTICLE SUMMARY */}
        {activeSection === 'summary' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-parchment-100 dark:bg-ink-950 border-l-4 border-crimson-700 p-3.5">
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                <strong className="text-crimson-800 dark:text-crimson-400">Why it matters: </strong>
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

        {/* VIEW 2: CONCEPT EXPLAINER (With Save Concept Bookmark right next to Beginner/Intermediate/Advanced) */}
        {activeSection === 'concept' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                {concept.conceptTerm}
              </h2>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Beginner / Intermediate / Advanced Pills */}
                <div className="inline-flex rounded-lg bg-parchment-100 dark:bg-ink-950 p-1">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setConceptDepth(level)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                        conceptDepth === level
                          ? 'bg-crimson-700 text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                {/* Bookmark Concept to Glossary Button */}
                <button
                  onClick={handleSaveConceptClick}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    conceptSaved
                      ? 'bg-crimson-700 text-white border-crimson-700'
                      : 'bg-parchment-50 dark:bg-ink-950 text-crimson-700 dark:text-crimson-400 border-crimson-300 dark:border-crimson-800 hover:bg-crimson-50'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${conceptSaved ? 'fill-current' : ''}`} />
                  <span>{conceptSaved ? 'Concept Saved to Glossary ✓' : 'Save Concept'}</span>
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              {concept[conceptDepth] || concept.beginner}
            </p>

            {concept.practicalExample && (
              <div className="p-3.5 rounded-xl bg-parchment-50 dark:bg-ink-950 border border-stone-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong className="block text-crimson-800 dark:text-crimson-400 mb-1">
                  Example:
                </strong>
                {concept.practicalExample}
              </div>
            )}
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
