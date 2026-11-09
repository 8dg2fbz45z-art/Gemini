import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import DashboardGrid from './components/DashboardGrid.jsx';
import CategoryFeed from './components/CategoryFeed.jsx';
import ArticleReader from './components/ArticleReader.jsx';
import ScholarsDrawer from './components/ScholarsDrawer.jsx';
import FirmWatchlistModal from './components/FirmWatchlistModal.jsx';
import GeminiSettingsModal from './components/GeminiSettingsModal.jsx';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [uiSettings, setUiSettings] = useState({
    fontSize: 'normal', // 'normal' | 'large' | 'xlarge'
    fontFamily: 'editorial', // 'editorial' | 'sans'
    accessibilityMode: false,
    maxBriefsPerTopic: 8,
  });
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'feed' | 'reader'
  const [bootstrapData, setBootstrapData] = useState(null);
  const [articles, setArticles] = useState([]);
  const [allArticlesCache, setAllArticlesCache] = useState([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState(null);

  // Feed Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedFirmId, setSelectedFirmId] = useState(null);
  const [facultyOnly, setFacultyOnly] = useState(false);
  const [watchedFirmsOnly, setWatchedFirmsOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [includeSamples, setIncludeSamples] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Reader State
  const [activeArticleId, setActiveArticleId] = useState(null);
  const [activeArticleData, setActiveArticleData] = useState(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [isRegeneratingAnalysis, setIsRegeneratingAnalysis] = useState(false);

  // Modals & Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('notebook');
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);

  // Scholar's Workspace Data
  const [glossary, setGlossary] = useState([]);
  const [notes, setNotes] = useState([]);
  const [weeklyDigest, setWeeklyDigest] = useState(null);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.classList.remove('font-size-large', 'font-size-xlarge');
    if (uiSettings.fontSize === 'large') root.classList.add('font-size-large');
    if (uiSettings.fontSize === 'xlarge') root.classList.add('font-size-xlarge');

    root.classList.toggle('font-style-sans', uiSettings.fontFamily === 'sans');
    root.classList.toggle('accessibility-mode', Boolean(uiSettings.accessibilityMode));
  }, [darkMode, uiSettings]);

  const handleUpdateUiSettings = (partial) => {
    setUiSettings((prev) => ({ ...prev, ...partial }));
  };

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch(`/api/bootstrap?includeSamples=${includeSamples}`);
      const data = await res.json();
      setBootstrapData(data);
    } catch (err) {
      console.error('Bootstrap fetch error:', err);
    }
  }, [includeSamples]);

  const fetchArticles = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategoryId && selectedCategoryId !== 'all') {
        params.set('categoryId', selectedCategoryId);
      }
      if (selectedFirmId) params.set('firmId', selectedFirmId);
      if (facultyOnly) params.set('facultyOnly', 'true');
      if (watchedFirmsOnly) params.set('watchedFirmsOnly', 'true');
      if (unreadOnly) params.set('readStatus', 'unread');
      params.set('includeSamples', String(includeSamples));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/articles?${params.toString()}`);
      const data = await res.json();
      setArticles(data.articles || []);

      // Also keep an unfiltered list for the Scholar's Drawer bookmarks & history
      const allRes = await fetch('/api/articles?includeSamples=true');
      const allData = await allRes.json();
      setAllArticlesCache(allData.articles || []);
    } catch (err) {
      console.error('Articles fetch error:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [
    selectedCategoryId,
    selectedFirmId,
    facultyOnly,
    watchedFirmsOnly,
    unreadOnly,
    includeSamples,
    searchQuery,
  ]);

  const fetchScholarsData = useCallback(async () => {
    try {
      const [gRes, nRes, dRes] = await Promise.all([
        fetch('/api/glossary'),
        fetch('/api/notes'),
        fetch('/api/digest'),
      ]);
      const [gData, nData, dData] = await Promise.all([
        gRes.json(),
        nRes.json(),
        dRes.json(),
      ]);
      setGlossary(gData.concepts || []);
      setNotes(nData.notes || []);
      setWeeklyDigest(dData);
    } catch (err) {
      console.error('Scholar workspace fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
    fetchArticles();
    fetchScholarsData();
  }, [fetchBootstrap, fetchArticles, fetchScholarsData]);

  // Automatically switch to Feed view across all categories when typing in Global Search
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    if (q.trim()) {
      setSelectedCategoryId('all');
      if (activeView !== 'feed') {
        setActiveView('feed');
      }
    }
  };

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setSelectedFirmId(null);
    setFacultyOnly(false);
    setWatchedFirmsOnly(false);
    setActiveView('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectFirmFilter = (firmId) => {
    setSelectedFirmId(firmId);
    setSelectedCategoryId('all');
    setFacultyOnly(false);
    setWatchedFirmsOnly(true);
    setActiveView('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectLawFirmInsight = () => {
    setWatchedFirmsOnly(true);
    setSelectedFirmId(null);
    setSelectedCategoryId('all');
    setFacultyOnly(false);
    setActiveView('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectFacultySpotlight = () => {
    setFacultyOnly(true);
    setWatchedFirmsOnly(false);
    setSelectedCategoryId('all');
    setSelectedFirmId(null);
    setActiveView('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectArticle = async (articleId) => {
    setActiveArticleId(articleId);
    setActiveView('reader');
    setIsLoadingArticle(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const res = await fetch(`/api/articles/${articleId}`);
      const data = await res.json();
      setActiveArticleData(data);
      fetchBootstrap();
      fetchArticles();
      fetchScholarsData();
    } catch (err) {
      console.error('Error opening article:', err);
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const handleRegenerateAnalysis = async (articleId) => {
    setIsRegeneratingAnalysis(true);
    try {
      await fetch(`/api/articles/${articleId}/analyze`, { method: 'POST' });
      const res = await fetch(`/api/articles/${articleId}`);
      const data = await res.json();
      setActiveArticleData(data);
      fetchArticles();
    } catch (err) {
      console.error('Error regenerating analysis:', err);
    } finally {
      setIsRegeneratingAnalysis(false);
    }
  };

  const handleTriggerRefresh = async () => {
    setIsRefreshing(true);
    setRefreshBanner(null);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      await Promise.all([fetchBootstrap(), fetchArticles()]);
      setRefreshBanner(
        `Live RSS Sync Complete: ${data.stats?.feedsSucceeded || 0}/${
          data.stats?.feedsAttempted || 0
        } feeds scanned, ${data.stats?.itemsInserted || 0} new developments added (${
          data.stats?.duplicatesSkipped || 0
        } duplicates skipped, ${data.stats?.lowImpactFiltered || 0} low-impact filtered).`
      );
      setTimeout(() => setRefreshBanner(null), 7000);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleBookmark = async (articleId) => {
    await fetch(`/api/articles/${articleId}/bookmark`, { method: 'POST' });
    if (activeArticleData?.article?.id === articleId) {
      setActiveArticleData((prev) => ({
        ...prev,
        article: { ...prev.article, isBookmarked: !prev.article.isBookmarked },
      }));
    }
    fetchBootstrap();
    fetchArticles();
  };

  const handleToggleReadStatus = async (articleId, status) => {
    await fetch(`/api/articles/${articleId}/read-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchBootstrap();
    fetchArticles();
  };

  const handleSaveGlossaryConcept = async (conceptPayload) => {
    await fetch('/api/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conceptPayload),
    });
    await Promise.all([fetchScholarsData(), fetchBootstrap()]);
  };

  const handleUpdateGlossaryMastery = async (id, masteryLevel) => {
    await fetch(`/api/glossary/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masteryLevel }),
    });
    fetchScholarsData();
  };

  const handleDeleteGlossaryConcept = async (id) => {
    await fetch(`/api/glossary/${id}`, { method: 'DELETE' });
    await Promise.all([fetchScholarsData(), fetchBootstrap()]);
  };

  const handleSaveResearchNote = async (notePayload) => {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notePayload),
    });
    if (activeArticleId) {
      const res = await fetch(`/api/articles/${activeArticleId}`);
      const data = await res.json();
      setActiveArticleData(data);
    }
    await Promise.all([fetchScholarsData(), fetchBootstrap()]);
  };

  const handleDeleteNote = async (id) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    await Promise.all([fetchScholarsData(), fetchBootstrap()]);
  };

  const handleRegenerateDigest = async () => {
    setIsGeneratingDigest(true);
    try {
      const res = await fetch('/api/digest/generate', { method: 'POST' });
      const data = await res.json();
      setWeeklyDigest(data);
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  const handleToggleWatchFirm = async (firmId, isWatched) => {
    await fetch(`/api/firms/${firmId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isWatched }),
    });
    fetchBootstrap();
  };

  const handleAddCustomFirm = async (firmPayload) => {
    await fetch('/api/firms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firmPayload),
    });
    fetchBootstrap();
  };

  const handleSaveGeminiSettings = async (settingsPayload) => {
    await fetch('/api/settings/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsPayload),
    });
    fetchBootstrap();
  };

  return (
    <div className="min-h-screen flex flex-col bg-parchment-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100">
      <Header
        activeView={activeView}
        onNavigateHome={() => {
          setActiveView('dashboard');
          setSearchQuery('');
        }}
        onSelectFacultySpotlight={handleSelectFacultySpotlight}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onTriggerRefresh={handleTriggerRefresh}
        isRefreshing={isRefreshing}
        aiStatus={bootstrapData?.aiStatus}
        stats={bootstrapData?.stats}
        onOpenDrawer={(tab) => {
          setDrawerTab(tab || 'notebook');
          setDrawerOpen(true);
        }}
        onOpenWatchlist={() => setWatchlistOpen(true)}
        onOpenGeminiSettings={() => setGeminiModalOpen(true)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />

      {refreshBanner && (
        <div className="bg-emerald-800 text-white text-xs py-2 px-4 text-center font-medium">
          {refreshBanner}
        </div>
      )}

      <main className="flex-1">
        {activeView === 'dashboard' && (
          <DashboardGrid
            categories={bootstrapData?.categories || []}
            spotlight={bootstrapData?.spotlight}
            maxBriefsPerTopic={uiSettings.maxBriefsPerTopic}
            lawFirms={bootstrapData?.lawFirms || []}
            verifiedFaculty={bootstrapData?.verifiedFaculty || []}
            includeSamples={includeSamples}
            onToggleIncludeSamples={setIncludeSamples}
            onSelectCategory={handleSelectCategory}
            onSelectArticle={handleSelectArticle}
            onSelectFirmFilter={handleSelectFirmFilter}
            onSelectFacultySpotlight={handleSelectFacultySpotlight}
            onSelectLawFirmInsight={handleSelectLawFirmInsight}
            onOpenWatchlist={() => setWatchlistOpen(true)}
            onOpenDrawer={(tab) => {
              setDrawerTab(tab);
              setDrawerOpen(true);
            }}
          />
        )}

        {activeView === 'feed' && (
          <CategoryFeed
            categories={bootstrapData?.categories || []}
            lawFirms={bootstrapData?.lawFirms || []}
            selectedCategoryId={selectedCategoryId}
            selectedFirmId={selectedFirmId}
            facultyOnly={facultyOnly}
            watchedFirmsOnly={watchedFirmsOnly}
            unreadOnly={unreadOnly}
            includeSamples={includeSamples}
            searchQuery={searchQuery}
            articles={articles}
            maxBriefsPerTopic={uiSettings.maxBriefsPerTopic}
            isLoading={isLoadingFeed}
            onBackToGrid={() => setActiveView('dashboard')}
            onSelectCategory={setSelectedCategoryId}
            onSelectFirm={setSelectedFirmId}
            onToggleFacultyOnly={setFacultyOnly}
            onToggleWatchedFirmsOnly={setWatchedFirmsOnly}
            onToggleUnreadOnly={setUnreadOnly}
            onToggleIncludeSamples={setIncludeSamples}
            onSelectArticle={handleSelectArticle}
            onToggleBookmark={handleToggleBookmark}
            onToggleReadStatus={handleToggleReadStatus}
          />
        )}

        {activeView === 'reader' && (
          <ArticleReader
            articleData={activeArticleData}
            isLoading={isLoadingArticle}
            onBack={() => setActiveView('feed')}
            onSelectArticle={handleSelectArticle}
            onToggleBookmark={handleToggleBookmark}
            onSaveGlossaryConcept={handleSaveGlossaryConcept}
            onSaveResearchNote={handleSaveResearchNote}
            onRegenerateAnalysis={handleRegenerateAnalysis}
            isRegenerating={isRegeneratingAnalysis}
            onOpenGeminiSettings={() => setGeminiModalOpen(true)}
          />
        )}
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-stone-200 dark:border-slate-800 py-6 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-ink-900/60 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>CrimsonBrief</strong> — Private Single-User Legal, Commercial &amp; Harvard LL.M. Intelligence Platform
          </div>
          <div>
            Persistent SQLite (`crimsonbrief.sqlite`) • Verified HLS Faculty &amp; Vault/AmLaw Registries • Google Gemini Engine
          </div>
        </div>
      </footer>

      <ScholarsDrawer
        isOpen={drawerOpen}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        allArticles={allArticlesCache}
        glossary={glossary}
        notes={notes}
        weeklyDigest={weeklyDigest}
        isGeneratingDigest={isGeneratingDigest}
        onRegenerateDigest={handleRegenerateDigest}
        onSelectArticle={handleSelectArticle}
        onUpdateGlossaryMastery={handleUpdateGlossaryMastery}
        onDeleteGlossaryConcept={handleDeleteGlossaryConcept}
        onAddNote={handleSaveResearchNote}
        onDeleteNote={handleDeleteNote}
      />

      <FirmWatchlistModal
        isOpen={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        lawFirms={bootstrapData?.lawFirms || []}
        onToggleWatchFirm={handleToggleWatchFirm}
        onAddCustomFirm={handleAddCustomFirm}
        onSelectFirmFilter={handleSelectFirmFilter}
      />

      <GeminiSettingsModal
        isOpen={geminiModalOpen}
        onClose={() => setGeminiModalOpen(false)}
        aiStatus={bootstrapData?.aiStatus}
        publicRssSources={bootstrapData?.publicRssSources || []}
        onSaveGeminiSettings={handleSaveGeminiSettings}
        uiSettings={uiSettings}
        onUpdateUiSettings={handleUpdateUiSettings}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />
    </div>
  );
}
