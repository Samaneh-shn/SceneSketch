export default function Library({ items, onOpen, onRemove }) {
  return (
    <section className="retro-box p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Library</h2>
        <span className="text-sm opacity-60">{items.length} book{items.length!==1?'s':''}</span>
      </div>

      {items.length === 0 ? (
        <p className="opacity-70 text-sm">No books yet. Use “Upload EPUB” to add one.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map(b => (
            <li key={b.id} className="retro-box p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold truncate">{b.name}</div>
                <div className="text-xs opacity-60">
                  {b.lastCfi ? 'Has a saved position • ' : ''}
                  Added {new Date(b.addedAt || Date.now()).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="tool-btn retro-box" title="Open" onClick={()=>onOpen(b.id)}>
                  <i className="fas fa-book-open"></i>
                </button>
                <button className="tool-btn retro-box" title="Remove" onClick={()=>onRemove(b.id)}>
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
