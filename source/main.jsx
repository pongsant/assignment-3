import { createRoot } from "react-dom/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

/* ---- data (no fetch) ---- */
import STREAMING_HISTORY from "./data/data.js";
import LYRICS from "./data/lyrics.js";

/* ---- import artist images dropped in /source/images ---- */
const importedImages = import.meta.glob("./images/*.{png,jpg,jpeg,webp}", { eager: true });
const IMAGE_BY_NAME = {};
for (const p in importedImages) {
  IMAGE_BY_NAME[p.split("/").pop().toLowerCase()] = importedImages[p].default;
}

/* ---- tiny hash router ---- */
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const parts = (hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  if (parts.length === 0) return { page: "home" };
  if (parts[0] === "song" && parts[1]) return { page: "song", id: parts[1] };
  return { page: "home" };
}

/* ---- helpers ---- */
const sanitize = (s) => String(s || "").toLowerCase().trim();
const toTrackId = (uri) => (uri ? (uri.split(":")[2] || "") : "");
const trackUrl  = (id)  => (id ? `https://open.spotify.com/track/${id}` : "#");

function coverForArtist(artist) {
  const base = sanitize(artist).replace(/[^a-z0-9]+/g, "_");
  const candidates = [`${base}.jpg`, `${base}.png`, `${base}.jpeg`, `${base}.webp`];
  for (const name of candidates) {
    if (IMAGE_BY_NAME[name]) return IMAGE_BY_NAME[name];
  }
  return `https://picsum.photos/seed/${encodeURIComponent(artist || "cover")}/400/400`;
}

/* Build list strictly from YOUR lyrics keys (keeps your chosen songs) */
function buildItemsFromHistory(history) {
  const order = Object.keys(LYRICS); // your 15 track IDs
  const byId = new Map();
  for (const r of history) {
    const id = toTrackId(r.spotify_track_uri);
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        title: r.master_metadata_track_name || "Untitled",
        artist: r.master_metadata_album_artist_name || "Unknown Artist",
        spotifyUrl: trackUrl(id),
      });
    }
  }
  const items = [];
  for (const id of order) {
    const row = byId.get(id);
    if (row) {
      items.push({ ...row });
    } else {
      items.push({
        id,
        title: "(title from history not found)",
        artist: "(artist from history not found)",
        spotifyUrl: trackUrl(id),
      });
    }
  }
  return items.slice(0, 15).map((s) => ({ ...s, cover: coverForArtist(s.artist) }));
}

/* ============================= */
/*              APP              */
/* ============================= */
function App() {
  const route = useRoute();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const rows = Array.isArray(STREAMING_HISTORY) ? STREAMING_HISTORY : [];
    setItems(buildItemsFromHistory(rows));
  }, []);

  if (route.page === "song") {
    const song = items.find((s) => s.id === route.id) || null;
    return <SongDetail song={song} onBack={() => (location.hash = "#/")} />;
  }
  return <OrbitHome items={items} />;
}

/* ============================= */
/*  PAGE 1: ORBIT + DROP PORTAL  */
/* ============================= */
function OrbitHome({ items }) {
  const portalRef = useRef(null);
  const [hover, setHover] = useState(false);

  // ensure portal receives drops (on both ring and inner halo)
  useEffect(() => {
    const dz = portalRef.current;
    if (!dz) return;

    const setOn = (el) => {
      if (!el) return;
      el.addEventListener("dragenter", onEnter);
      el.addEventListener("dragover", onOver);
      el.addEventListener("dragleave", onLeave);
      el.addEventListener("drop", onDrop);
    };
    const setOff = (el) => {
      if (!el) return;
      el.removeEventListener("dragenter", onEnter);
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };

    function onEnter(e){ e.preventDefault(); setHover(true); }
    function onOver(e){ e.preventDefault(); setHover(true); }
    function onLeave(){ setHover(false); }
    function onDrop(e){
      e.preventDefault();
      const id = e.dataTransfer.getData("text/songId");
      setHover(false);
      if (id) location.hash = `#/song/${encodeURIComponent(id)}`;
    }

    setOn(dz);
    setOn(dz.querySelector(".halo"));

    // global: allow drop anywhere so browser doesn't block it
    const prevent = (e) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);

    return () => {
      setOff(dz);
      setOff(dz.querySelector(".halo"));
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  // evenly spaced angles around the circle
  const angles = useMemo(() => {
    const a = [];
    const n = Math.max(items.length, 1);
    for (let i = 0; i < n; i++) a.push((i / n) * Math.PI * 2);
    return a;
  }, [items.length]);

  return (
    <div className="orbit-wrap">
      {/* ambient background */}
      <div className="ambience" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="grain" />
      </div>

      <header className="hero-head">
        <h1>Song Diary</h1>
        <p>Drag a cover into the circle, or click to open the entry</p>
      </header>

      <div className="stage">
        <div ref={portalRef} className={`portal ${hover ? "hover" : ""}`}>
          <div className="halo" />
        </div>

        {/* rotating ring */}
        <ul className="orbit" aria-label="Orbiting covers">
          {items.map((s, i) => (
            <li
              key={s.id}
              className="orbit-item"
              style={{ "--angle": angles[i] }}
            >
              <CoverButton item={s} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CoverButton({ item }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("text/songId", item.id);
    e.dataTransfer.effectAllowed = "move";
    // nicer drag image (use the cover itself)
    const img = new Image();
    img.src = item.cover;
    img.onload = () => e.dataTransfer.setDragImage(img, 60, 60);
  };
  return (
    <button
      className="cover"
      draggable
      onDragStart={onDragStart}
      onClick={() => (location.hash = `#/song/${encodeURIComponent(item.id)}`)}
      aria-label={`${item.artist} — ${item.title}`}
      title={`${item.artist} — ${item.title}`}
    >
      <img src={item.cover} alt={item.artist} />
      <div className="tag">
        <div className="artist">{item.artist}</div>
        <div className="title">{item.title}</div>
      </div>
    </button>
  );
}

/* ============================= */
/*   PAGE 2: SONG DETAIL (READ)  */
/* ============================= */
function SongDetail({ song, onBack }) {
  if (!song) {
    return (
      <div className="detail dark">
        <button className="back" onClick={onBack}>← Back</button>
        <p>Song not found.</p>
      </div>
    );
  }
  const lyrics = LYRICS[song.id] || "";

  return (
    <div className="detail dark">
      <button className="back" onClick={onBack}>← Back</button>

      <header className="sheet-head">
        <img className="sheet-cover" src={song.cover} alt={song.artist} />
        <div>
          <h2 className="sheet-artist">{song.artist}</h2>
          <p className="sheet-title">{song.title}</p>
          <a className="play" href={song.spotifyUrl} target="_blank" rel="noreferrer">
            Open on Spotify ↗
          </a>
        </div>
      </header>

      <section className="sheet-body">
        <h3 className="section-label">Lyrics</h3>
        <div className="lyrics-read">
          {lyrics ? lyrics : "/source/data/lyrics.js"}
        </div>
      </section>
    </div>
  );
}

/* mount */
createRoot(document.getElementById("root")).render(<App />);
