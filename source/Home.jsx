import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SONGS } from "../data.js";

export default function Home() {
  const navigate = useNavigate();
  const [items, setItems] = useState(SONGS);
  const [hot, setHot] = useState(false);
  const draggedId = useRef(null);

  // tiny float animation (random offsets) — optional
  useEffect(() => {
    const nodes = document.querySelectorAll(".card");
    nodes.forEach((n) => {
      const x = (Math.random() * 2 - 1) * 6;
      const y = (Math.random() * 2 - 1) * 6;
      n.style.transform = `translate(${x}px, ${y}px)`;
    });
  }, [items]);

  function onDragStart(e, id) {
    draggedId.current = id;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropPortal(e) {
    e.preventDefault();
    setHot(false);
    const id = draggedId.current || e.dataTransfer.getData("text/plain");
    if (!id) return;
    navigate(`/song/${encodeURIComponent(id)}`);
  }

  return (
    <div className="app">
      <h1 className="h1">Music Portal</h1>
      <p className="p">Drag an album cover into the portal to open its page.</p>

      <div className="portalWrap">
        <div
          className={`portal ${hot ? "hot" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setHot(true);
          }}
          onDragLeave={() => setHot(false)}
          onDrop={onDropPortal}
          role="button"
          aria-label="Drop here to enter song page"
          onClick={() => {
            // click fallback: open the first item
            if (items[0]) navigate(`/song/${items[0].id}`);
          }}
        >
          Drop here to enter
        </div>
      </div>

      <div className="grid">
        {items.map((s) => (
          <div
            key={s.id}
            className="card"
            draggable
            onDragStart={(e) => onDragStart(e, s.id)}
            onDoubleClick={() => navigate(`/song/${s.id}`)} // accessibility fallback
            title="Drag into the portal, or double-click"
          >
            <img className="cover" src={s.cover} alt={s.title} />
            <div className="meta">
              <div>{s.title}</div>
              <div className="small">{s.artist}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
