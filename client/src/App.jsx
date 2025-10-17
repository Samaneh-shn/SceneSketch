import { useMemo, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HeaderBar from './components/HeaderBar.jsx';
import ReaderPane from './components/ReaderPane.jsx';
import ControlsBar from './components/ControlsBar.jsx';
import ToolsDrawer from './components/ToolsDrawer.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import Downloads from './components/Downloads.jsx';
import Saved from './components/Saved.jsx';
import Library from './components/Library.jsx';
import useEpubReader from './hooks/useEpubReader.js';

/* ------- simple persistence helpers ------- */
const readJSON = (k, d=[]) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const GALLERY_KEY   = 'ss_gallery_v1';
const HIGHLIGHT_KEY = 'ss_highlights_v1';
const PROMPTS_KEY   = 'ss_prompts_v1';

export default function App() {
  const [theme, setTheme] = useState('light');
  const [pageInput, setPageInput] = useState('1');
  const [paragraph, setParagraph] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activePage, setActivePage] = useState('home');

  // persisted global lists
  const [gallery, setGallery]       = useState(() => readJSON(GALLERY_KEY, []));
  const [highlights, setHighlights] = useState(() => readJSON(HIGHLIGHT_KEY, []));
  const [savedPrompts, setSavedPrompts] = useState(() => readJSON(PROMPTS_KEY, []));

  // persist whenever they change
  useEffect(()=>writeJSON(GALLERY_KEY, gallery), [gallery]);
  useEffect(()=>writeJSON(HIGHLIGHT_KEY, highlights), [highlights]);
  useEffect(()=>writeJSON(PROMPTS_KEY, savedPrompts), [savedPrompts]);

  const {
    fileName, error,
    currentPage, totalPagesDisplay, progress,
    loadFromFile, next, prev, goToPage, seekPercent,
    bookmarks, addBookmark, deleteBookmark, exportBookmarks, goToBookmark,
    library, openFromLibrary, removeFromLibrary, refreshLibrary
  } = useEpubReader({
    theme,
    onTextSelected: (text) => { setParagraph(text || ''); setToolsOpen(true); }
  });

  const pageLabel = useMemo(() => String(currentPage || 1), [currentPage]);

  const handleGo = () => {
    const total = Math.max(1, totalPagesDisplay || 1);
    const n = parseInt(pageInput, 10);
    if (isNaN(n) || n < 1 || n > total) {
      setPageInput(String(currentPage || 1));
      return;
    }
    goToPage(n);
  };

  const toggleTheme = () => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
    document.documentElement.classList.toggle('dark', theme !== 'dark');
  };

  /* ---------- Save Highlight (manual) ---------- */
  const handleSaveHighlight = () => {
    const iframe = document.querySelector('#reader iframe');
    let liveSel = '';
    try { liveSel = iframe?.contentWindow?.getSelection?.()?.toString?.().trim() || ''; } catch {}
    let text = liveSel || (paragraph || '').trim();
    if (!text) return;

    setHighlights(h => [{
      id: crypto.randomUUID(),
      text,
      bookTitle: fileName || 'Untitled',
      page: currentPage || 1,
      createdAt: new Date().toISOString(),
    }, ...h]);

    try {
      const sel = iframe?.contentWindow?.getSelection?.();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    } catch {}
    setParagraph('');
  };

  /* ---------- Tools callbacks (persisted by effects above) ---------- */
  const handleImageCreated = ({ url, style, prompt }) => {
    setGallery(g => [{
      id: crypto.randomUUID(),
      url, style, prompt,
      bookTitle: fileName || 'Untitled',
      createdAt: new Date().toISOString(),
    }, ...g]);
  };

  const handlePromptSaved = ({ prompt, style, source }) => {
    setSavedPrompts(p => [{
      id: crypto.randomUUID(),
      prompt, style, source,
      bookTitle: fileName || 'Untitled',
      createdAt: new Date().toISOString(),
    }, ...p]);
  };

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={(pg) => { setActivePage(pg); if (pg === 'library') refreshLibrary(); }}
      />

      <div className="flex flex-col gap-3">
        <HeaderBar
          onThemeToggle={toggleTheme}
          onFile={(f) => { if (f) { loadFromFile(f); setPageInput('1'); setActivePage('home'); } }}
        />

        {/* Keep reader mounted; hide when not on Home */}
        <section className="retro-box p-4" style={{ display: activePage === 'home' ? 'block' : 'none' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="SceneSketch Logo" style={{ width: 48, height: 48 }} />
              <h1 className="text-2xl font-semibold">SceneSketch Reader</h1>
            </div>

            <div className="header-actions">
              {/* highlight button first (left) */}
              <button
                className="tool-btn retro-box"
                title="Save highlight"
                onClick={handleSaveHighlight}
              >
                <i className="fas fa-highlighter" />
              </button>

              {/* tools button second (right) */}
              <button
                className={`tool-btn retro-box ${toolsOpen ? 'active' : ''}`}
                title="Scene Tools"
                onClick={() => setToolsOpen(v => !v)}
              >
                <b>T</b>
              </button>
            </div>
          </div>

          <div className="content-row mt-4">
            <div className="reader-wrap retro-box">
              <ReaderPane />

              <ControlsBar
                pageLabel={pageLabel}
                totalLabel={totalPagesDisplay}
                onPrev={prev}
                onNext={next}
                onGo={handleGo}
                pageInput={pageInput}
                setPageInput={setPageInput}
                progress={progress}
                onSeek={seekPercent}
                onAddBookmark={addBookmark}
              />

              <p className="text-xs opacity-60 mt-2">
                Bookmarks, highlights & prompts live under <b>Saved</b>. Generated images live under <b>Downloads</b>.
              </p>

              {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
            </div>

            <ToolsDrawer
              isOpen={toolsOpen}
              onClose={() => setToolsOpen(false)}
              paragraph={paragraph}
              setParagraph={setParagraph}
              onImageCreated={handleImageCreated}
              onPromptSaved={handlePromptSaved}
            />
          </div>
        </section>

        {activePage === 'download' && (
          <Downloads images={gallery} onOpenReader={() => setActivePage('home')} />
        )}

        {activePage === 'saved' && (
          <Saved
            bookmarks={bookmarks}
            highlights={highlights}
            prompts={savedPrompts}
            onGoBookmark={goToBookmark}
            onDeleteBookmark={deleteBookmark}
            onExportBookmarks={exportBookmarks}
            onOpenReader={() => setActivePage('home')}
          />
        )}

        {activePage === 'library' && (
          <Library
            items={library}
            onOpen={async (id) => { await openFromLibrary(id); setActivePage('home'); }}
            onRemove={async (id) => { await removeFromLibrary(id); }}
          />
        )}

        {activePage === 'settings' && (
          <section className="retro-box p-4"><h2 className="text-xl font-bold">Settings</h2></section>
        )}
        {activePage === 'support' && (
          <section className="retro-box p-4"><h2 className="text-xl font-bold">Support</h2></section>
        )}
        {activePage === 'category' && (
          <section className="retro-box p-4"><h2 className="text-xl font-bold">Categories</h2></section>
        )}

        <PlayerBar fileName={fileName} progress={progress} onPrev={prev} onNext={next} />
      </div>
    </div>
  );
}
//working