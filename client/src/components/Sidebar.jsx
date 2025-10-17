// client/src/components/Sidebar.jsx
export default function Sidebar({ activePage, setActivePage }) {
  const top = [
    { id: 'home',     icon: 'fa-fire',               label: 'Home' },
    { id: 'category', icon: 'fa-table-cells-large',  label: 'Category' },
    { id: 'library',  icon: 'fa-book',               label: 'Library' },
    { id: 'download', icon: 'fa-download',           label: 'Download' },
    { id: 'saved',    icon: 'fa-bookmark',           label: 'Saved' },
  ];

  const bottom = [
    { id: 'settings', icon: 'fa-gear',               label: 'Settings' },
    { id: 'support',  icon: 'fa-life-ring',          label: 'Support' },
    { id: 'logout',   icon: 'fa-right-from-bracket', label: 'Logout' },
  ];

  const renderBtn = (item) => (
    <button
      key={item.id}
      type="button"
      className={`nav-btn ${activePage === item.id ? 'active' : ''}`}
      onClick={() => {
        // simple route switch; you can handle real logout in App if needed
        if (item.id === 'logout') {
          // placeholder: go “home” for now
          setActivePage('home');
          return;
        }
        setActivePage(item.id);
      }}
      aria-current={activePage === item.id ? 'page' : undefined}
    >
      <i className={`fas ${item.icon}`} aria-hidden="true"></i>
      <span>{item.label}</span>
    </button>
  );

  return (
    <aside className="rail retro-box">
      <nav className="nav" aria-label="Primary">
        <div className="nav-top">
          {top.map(renderBtn)}
        </div>
        <div className="nav-bottom">
          {bottom.map(renderBtn)}
        </div>
      </nav>
    </aside>
  );
}
