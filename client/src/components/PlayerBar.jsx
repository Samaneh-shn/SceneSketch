export default function PlayerBar({ fileName, progress, onPrev, onNext }) {
  return (
    <footer className="player-bar">
      <div className="player-meta">
        <img src="/logo.png" alt="cover"/>
        <div className="min-w-0">
          <div className="player-title">{fileName || 'No book loaded'}</div>
          <div className="player-links text-sm">
            <span className="linkish">SceneSketch</span> • <span className="linkish">Reader</span>
          </div>
        </div>
      </div>

      <div className="player-controls">
        <button onClick={onPrev} className="retro-box px-2 py-2" title="Back"><i className="fas fa-undo"></i></button>
        <button className="retro-box px-3 py-2" title="Pause"><i className="fas fa-pause"></i></button>
        <button onClick={onNext} className="retro-box px-2 py-2" title="Forward"><i className="fas fa-redo"></i></button>
      </div>

      <div className="player-progress">
        <span style={{fontSize:12}}>2×</span>
        <div className="progress w-full">
          <div className="progress-bar" style={{width:`${progress}%`}}></div>
        </div>
        <span style={{fontSize:12}}>{Math.round(progress)}%</span>
      </div>
    </footer>
  );
}
