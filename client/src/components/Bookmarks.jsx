export default function Bookmarks({ items, onGo, onDelete, onExport }) {
  if (!items.length) return null;
  return (
    <div className="retro-box p-3 mt-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">Bookmarks</h3>
        <button onClick={onExport} className="retro-box px-3 py-1">Export</button>
      </div>
      <ul className="space-y-2">
        {items.map((b,i)=>(
          <li key={i} className="flex items-center justify-between">
            <span className="cursor-pointer hover:underline text-sm" onClick={()=>onGo(b.cfi)}>
              {b.text ? b.text + ' ' : ''}(Pages {b.pageRange})
            </span>
            <button className="retro-box px-2 py-1" onClick={()=>onDelete(b.cfi)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
