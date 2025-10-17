export default function ControlsBar({
  pageLabel,
  totalLabel,
  onPrev,
  onNext,
  onGo,
  pageInput,
  setPageInput,
  progress,
  onSeek,
  onAddBookmark
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <button onClick={onPrev} className="retro-box px-3 py-2"><i className="fas fa-arrow-left"></i></button>

      <span style={{fontSize:12}}>Pages {pageLabel} of {totalLabel}</span>

      <div className="player-progress flex-1">
        <div className="progress w-full" onClick={(e)=>{
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left)/rect.width;
          onSeek(pct);
        }}>
          <div className="progress-bar" style={{width:`${progress}%`}}></div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input value={pageInput} onChange={(e)=>setPageInput(e.target.value)} className="retro-box px-2 py-2 w-20 text-center" placeholder="Page" />
        <button onClick={onGo} className="retro-box px-3 py-2">Go</button>
      </div>

      <button onClick={onNext} className="retro-box px-3 py-2"><i className="fas fa-arrow-right"></i></button>
      <button onClick={onAddBookmark} className="retro-box px-3 py-2"><i className="fas fa-bookmark"></i></button>
    </div>
  );
}
