import { useState } from 'react';

function sanitize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}
function stamp(dIso) {
  try {
    const d = new Date(dIso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  } catch { return 'now'; }
}
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || 'image.png';
  document.body.appendChild(a); a.click(); a.remove();
}

export default function Downloads({ images = [], onOpenReader }) {
  const [lightbox, setLightbox] = useState(null);

  return (
    <section className="retro-box p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Downloads</h2>
        <button className="retro-box px-3 py-2" onClick={onOpenReader}>Back to Reader</button>
      </div>

      {!images.length && <p className="opacity-70">No generated images yet.</p>}

      {!!images.length && (
        <div className="grid gap-4" style={{gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))'}}>
          {images.map(it=>{
            const fname = `${sanitize(it.bookTitle)}_${sanitize(it.style)}_${stamp(it.createdAt)}.png`;
            return (
              <div key={it.id} className="retro-box p-2">
                <div className="text-xs mb-1 font-semibold truncate" title={it.bookTitle}>
                  {it.bookTitle}
                </div>
                <button className="block w-full" title="Open" onClick={()=>setLightbox(it)}>
                  <img src={it.url} alt="Generated" className="w-full h-40 object-cover rounded-md" />
                </button>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-70">{it.style}</span>
                  <button className="retro-box px-2 py-1 text-xs" onClick={()=>downloadDataUrl(it.url, fname)}>
                    <i className="fas fa-download mr-1"></i>Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div className="modal show" onClick={()=>setLightbox(null)} style={{zIndex:1000}}>
          <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{lightbox.bookTitle} • {lightbox.style}</div>
              <div className="flex gap-2">
                <button
                  className="retro-box px-2 py-1"
                  onClick={()=>{
                    const fname = `${sanitize(lightbox.bookTitle)}_${sanitize(lightbox.style)}_${stamp(lightbox.createdAt)}.png`;
                    downloadDataUrl(lightbox.url, fname);
                  }}
                >
                  <i className="fas fa-download mr-1"></i>Download
                </button>
                <button className="retro-box px-2 py-1" onClick={()=>setLightbox(null)}>
                  <i className="fas fa-xmark"></i>
                </button>
              </div>
            </div>
            <img src={lightbox.url} alt="Preview" className="w-full max-h-[70vh] object-contain rounded-md" />
            {lightbox.prompt && (
              <div className="mt-3 p-2 retro-box">
                <div className="text-xs font-semibold mb-1">Prompt</div>
                <div className="text-sm leading-snug opacity-80">{lightbox.prompt}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
