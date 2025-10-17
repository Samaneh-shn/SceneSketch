export default function HeaderBar({ onThemeToggle, onFile }) {
  return (
    <header className="header-bar retro-box">
      <div className="search-wrap">
        <i className="fas fa-search"></i>
        <input placeholder="Title, author, host, or topic" />
      </div>
      <div className="user-card retro-box">
        <img src="https://i.pravatar.cc/60?img=12" alt="avatar"/>
        <div style={{lineHeight:'1.1'}}>
          <div style={{fontWeight:600}}>Samaneh</div>
          <div style={{fontSize:12, opacity:.7}}>Story Seeker</div>
        </div>
        <i className="fas fa-chevron-down" style={{marginLeft:6}}></i>
      </div>
      <button className="notify retro-box" title="Theme" onClick={onThemeToggle}><i className="far fa-moon"></i></button>

      <label className="retro-box px-3 py-2 cursor-pointer">
        <i className="fas fa-file-arrow-up mr-2"></i> Upload EPUB
        <input type="file" accept=".epub" className="hidden" onChange={(e)=>onFile(e.target.files?.[0])}/>
      </label>
    </header>
  );
}
