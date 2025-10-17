import { useEffect, useRef, useState } from "react";

export default function ImageLightbox({ src, alt = "Generated scene", onClose }) {
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const originRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(4, s + 0.1));
      if (e.key === "-" || e.key === "_") setScale((s) => Math.max(0.5, s - 0.1));
      if (e.key === "0") setScale(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startPan = (e) => {
    setIsPanning(true);
    originRef.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = { ...drag };
  };
  const movePan = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    setDrag({ x: dragStartRef.current.x + dx, y: dragStartRef.current.y + dy });
  };
  const endPan = () => setIsPanning(false);

  const download = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = "scenesketch.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="lb-overlay" role="dialog" aria-modal="true"
         onMouseMove={movePan} onMouseUp={endPan} onMouseLeave={endPan}
         onClick={onClose}>
      <div className="lb-toolbar retro-box" onClick={(e)=>e.stopPropagation()}>
        <button className="lb-btn" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} aria-label="Zoom out">−</button>
        <button className="lb-btn" onClick={() => setScale(1)} aria-label="Reset zoom">100%</button>
        <button className="lb-btn" onClick={() => setScale((s) => Math.min(4, s + 0.1))} aria-label="Zoom in">+</button>
        <div className="lb-spacer" />
        <button className="lb-btn" onClick={download} aria-label="Download">Download</button>
        <button className="lb-btn" onClick={onClose} aria-label="Close">Close ✕</button>
      </div>

      <div className="lb-canvas" onClick={(e)=>e.stopPropagation()} onMouseDown={startPan}>
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${drag.x}px, ${drag.y}px) scale(${scale})` }}
          className="lb-img"
        />
      </div>
    </div>
  );
}
