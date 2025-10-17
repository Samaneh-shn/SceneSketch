import { useMemo, useState } from 'react';

export default function Saved({
  bookmarks = [],
  highlights = [],
  prompts = [],
  onGoBookmark,
  onDeleteBookmark,
  onExportBookmarks,
  onOpenReader,
}) {
  const [tab, setTab] = useState('highlights');
  const [openId, setOpenId] = useState(null);

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso || ''; }
  };

  const TabBtn = ({ id, children }) => (
    <button
      className={`retro-box px-3 py-2 ${tab === id ? 'bg-yellow-200' : ''}`}
      onClick={() => { setTab(id); setOpenId(null); }}
    >
      {children}
    </button>
  );

  const Empty = ({ children }) => <div className="opacity-60 text-sm">{children}</div>;

  return (
    <section className="retro-box p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Saved</h2>
        <button className="retro-box px-3 py-2" onClick={onOpenReader}>Back to Reader</button>
      </div>

      <div className="flex gap-2 mb-4">
        <TabBtn id="highlights">Highlights</TabBtn>
        <TabBtn id="bookmarks">Bookmarks</TabBtn>
        <TabBtn id="prompts">Prompts</TabBtn>
      </div>

      {tab === 'highlights' && (
        <div className="flex flex-col gap-2">
          {!highlights.length && <Empty>No highlights yet.</Empty>}
          {highlights.map(h => (
            <div key={h.id} className="retro-box p-3 cursor-pointer" onClick={() => setOpenId(openId === h.id ? null : h.id)}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {h.bookTitle ? `${h.bookTitle} • ` : ''}Page {h.page}
                </div>
                <div className="text-xs opacity-60">{fmtDate(h.createdAt)}</div>
              </div>
              <div className="mt-1 text-sm line-clamp-2">{h.text}</div>
              {openId === h.id && <div className="mt-2 p-2 bg-white rounded border text-sm">{h.text}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'bookmarks' && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center mb-1">
            <div className="font-semibold">Bookmarks</div>
            <button className="retro-box px-2 py-1 text-sm" onClick={onExportBookmarks}>Export</button>
          </div>
          {!bookmarks.length && <Empty>No bookmarks yet.</Empty>}
          {bookmarks.map((b, idx) => (
            <div key={b.cfi || idx} className="retro-box p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {b.bookTitle ? `${b.bookTitle} • ` : ''}Pages {b.pageRange}
                </div>
                <div className="flex gap-2">
                  <button className="retro-box px-2 py-1 text-sm" onClick={() => onGoBookmark(b.cfi)}>Go</button>
                  <button className="retro-box px-2 py-1 text-sm" onClick={() => onDeleteBookmark(b.cfi)}>Delete</button>
                </div>
              </div>
              {b.text && <div className="mt-1 text-sm">{b.text}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'prompts' && (
        <div className="flex flex-col gap-2">
          {!prompts.length && <Empty>No saved prompts yet.</Empty>}
          {prompts.map(p => (
            <div key={p.id} className="retro-box p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {p.bookTitle ? `${p.bookTitle} • ` : ''}{p.style || '—'} • {fmtDate(p.createdAt)}
                </div>
              </div>
              <div className="mt-1 text-sm">
                <div className="font-semibold">Prompt</div>
                <div className="whitespace-pre-wrap">{p.prompt}</div>
              </div>
              {p.source && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm underline">Source paragraph</summary>
                  <div className="mt-1 p-2 bg-white rounded border text-sm whitespace-pre-wrap">
                    {p.source}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
