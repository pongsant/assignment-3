/* --------- Page 1: COLLAGE (editorial overlaps) + drag into portal --------- */
function Entrance({ items }) {
  const portalRef = useRef(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const dz = portalRef.current;
    const onDragOver = (e) => { e.preventDefault(); setHover(true); };
    const onDragLeave = () => setHover(false);
    const onDrop = (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/songId");
      setHover(false);
      if (id) location.hash = `#/song/${encodeURIComponent(id)}`;
    };
    dz.addEventListener("dragover", onDragOver);
    dz.addEventListener("dragleave", onDragLeave);
    dz.addEventListener("drop", onDrop);
    return () => {
      dz.removeEventListener("dragover", onDragOver);
      dz.removeEventListener("dragleave", onDragLeave);
      dz.removeEventListener("drop", onDrop);
    };
  }, []);

  // per-tile visual jitter (rotation / vertical offset / z-depth)
  const styleMeta = useMemo(() => {
    return items.map(() => ({
      r: (Math.random() * 8 - 4).toFixed(2) + "deg",
      y: Math.floor(Math.random() * 60 - 30) + "px",
      z: Math.floor(Math.random() * 6) + 1
    }));
  }, [items.length]);

  return (
    <div className="wrap entrance">
      <header className="brand">
        <h1>Fifteen Artists</h1>
        <p className="sub">Drag a cover into the circle • or click to open</p>
      </header>

      <div ref={portalRef} className={`portal portal--light ${hover ? "hover" : ""}`}>
        <div className="portal-hole" />
      </div>

      {/* Editorial collage (multi-column + gentle overlaps) */}
      <ul className="collage" aria-label="Artist collage">
        {items.map((s, i) => (
          <li
            key={s.id}
            className="tile"
            style={{ "--r": styleMeta[i]?.r, "--y": styleMeta[i]?.y, "--z": styleMeta[i]?.z }}
          >
            <ArtistCard item={s} index={i + 1} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArtistCard({ item, index }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("text/songId", item.id);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <figure className="card" style={{ zIndex: "var(--z)" }}>
      <button
        className="album"
        draggable
        onDragStart={onDragStart}
        onClick={() => (location.hash = `#/song/${encodeURIComponent(item.id)}`)}
        aria-label={`${item.artist} — ${item.title}`}
        title={`${item.artist} — ${item.title}`}
      >
        <img src={item.cover} alt={item.artist} />
      </button>
      <figcaption className="caption">
        <span className="num">{String(index).padStart(2, "0")}</span>
        <span className="name">{item.artist}</span>
      </figcaption>
    </figure>
  );
}
