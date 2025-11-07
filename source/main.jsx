import { createRoot } from "react-dom/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

/* Use your JS data (no fetch) */
import STREAMING_HISTORY from "./data/data.js";
import PRESET_LYRICS from "./data/lyrics.js";

/* Import any images you drop into /source/images (any extension) */
const importedImages = import.meta.glob("./images/*.{png,jpg,jpeg,webp}", { eager: true });
const IMAGE_BY_NAME = {};
for (const p in importedImages) {
  IMAGE_BY_NAME[p.split("/").pop().toLowerCase()] = importedImages[p].default;
}

/* --- tiny hash router --- */
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

/* --- helpers --- */
const sanitize = (s) => String(s || "").toLowerCase().trim();
const toTrackId = (uri) => (uri ? (uri.split(":")[2] || "") : "");
const trackUrl  = (id)  => (id ? `https://open.spotify.com/track/${id}` : "#");

/* choose an image by artist filename or fallback */
function coverForArtist(artist) {
  const base = sanitize(artist).replace(/[^a-z0-9]+/g, "_");
  const candidates = [`${base}.jpg`, `${base}.png`, `${base}.jpeg`, `${base}.webp`];
  for (const name of candidates) {
    if (IMAGE_BY_NAME[name]) return IMAGE_BY_NAME[name];
  }
  return `https://picsum.photos/seed/${encodeURIComponent(artist)}/300/300`;
}

/* build: 15 artists → pick their single top song from your history */
function pick15Artists(rows) {
  const byArtist = new Map();
  for (const r of rows) {
    const title  = r.master_metadata_track_name;
    const artist = r.master_metadata_album_artist_name;
    if (!title || !artist) continue;
    const aKey = sanitize(artist);
    const id   = toTrackId(r.spotify_track_uri) || `${title}::${artist}`;
    if (!byArtist.has(aKey)) byArtist.set(aKey, { artist, total: 0, tracks: new Map() });
    const A = byArtist.get(aKey);
    A.total += Number(r.ms_played || 0);
    if (!A.tracks.has(id)) A.tracks.set(id, { id, title, ms: 0 });
    A.tracks.get(id).ms += Number(r.ms_played || 0);
  }
  const top = [];
  for (const [, A] of byArtist) {
    const best = [...A.tracks.values()].sort((x, y) => y.ms - x.ms)[0];
    if (!best) continue;
    top.push({
      id: best.id,
      artist: A.artist,
      title: best.title,
      total: A.total,
      spotifyUrl: trackUrl(best.id),
    });
  }
  top.sort((a, b) => b.total - a.total);
  return top.slice(0, 15);
}

/* lyrics store (preset + localStorage) */
const LYRICS_KEY = "lyrics_map_v1";
function useLyrics() {
  const [map, setMap] = useState(() => {
    try {
      const raw = localStorage.getItem(LYRICS_KEY);
      if (raw) return { ...PRESET_LYRICS, ...JSON.parse(raw) };
    } catch {}
    return { ...PRESET_LYRICS };
  });
  useEffect(() => { try { localStorage.setItem(LYRICS_KEY, JSON.stringify(map)); } catch {} }, [map]);
  return { get: (id) => map[id] || "", set: (id, text) => setMap((m) => ({ ...m, [id]: text })) };
}

/* --------- App --------- */
function App() {
  const route = useRoute();
  const lyrics = useLyrics();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const rows = Array.isArray(STREAMING_HISTORY)
      ? STREAMING_HISTORY.filter(r => r.master_metadata_track_name && r.master_metadata_album_artist_name)
      : [];
    const list = pick15Artists(rows).map(s => ({ ...s, cover: coverForArtist(s.artist) }));
    setItems(list);
  }, []);

  if (route.page === "song") {
    const song = items.find(s => s.id === route.id) || null;
    return <SongDetail song={song} onBack={() => (location.hash = "#/")} lyrics={lyrics} />;
  }
  return <Entrance items={items} />;
}

/* --------- Page 1: ORBIT RING + drag into portal --------- */
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

  // fixed ring layout (no random jitter) so it feels fresh vs old project
  const angleStep = (Math.PI * 2) / Math.max(items.length, 1);
  const radiusPx = 280; // distance from center

  return (
    <div className="wrap entrance">
      <header className="brand">
        <h1>Orbit — 15 Artists</h1>
        <p className="sub">Drag a cover into the portal • or click to open</p>
      </header>

      <div ref={portalRef} className={`portal ${hover ? "hover" : ""}`}>
        <div className="portal-hole" />
      </div>

      {/* Orbiting ring (CSS rotates the whole group) */}
      <div className="orbit" aria-label="Orbiting artist covers">
        {items.map((s, i) => {
          const a = i * angleStep;
          const x = Math.cos(a) * radiusPx;
          const y = Math.sin(a) * radiusPx;
          return (
            <div
              key={s.id}
              className="orbit-item"
              style={{ transform: `translate(${x}px, ${y}px) rotate(${a}rad)` }}
            >
              <ArtistButton item={s} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArtistButton({ item }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("text/songId", item.id);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <button
      className="album"
      draggable
      onDragStart={onDragStart}
      onClick={() => (location.hash = `#/song/${encodeURIComponent(item.id)}`)}
      title={`${item.artist} — ${item.title}`}
      aria-label={`${item.artist} — ${item.title}`}
    >
      <img src={item.cover} alt={`${item.artist}`} />
    </button>
  );
}

/* --------- Page 2: song detail (Spotify link + lyrics you type) --------- */
function SongDetail({ song, onBack, lyrics }) {
  if (!song) {
    return (
      <div className="detail" style={{ padding: 24 }}>
        <button className="back" onClick={onBack}>← Back</button>
        <p>Song not found.</p>
      </div>
    );
  }
  const [text, setText] = useState(() => lyrics.get(song.id));
  useEffect(() => { setText(lyrics.get(song.id)); }, [song.id]);
  const save = () => lyrics.set(song.id, text);

  return (
    <div className="detail" style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <button className="back" onClick={onBack}>← Back</button>

      <header className="song-head" style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, alignItems: "center", marginTop: 16 }}>
        <img src={song.cover} alt={song.artist} style={{ width: 160, height: 160, borderRadius: 18, objectFit: "cover" }} />
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{song.artist}</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>{song.title}</p>
          <a className="play" href={song.spotifyUrl} target="_blank" rel="noreferrer">Open on Spotify ↗</a>
        </div>
      </header>

      <section style={{ marginTop: 24 }}>
        <h3>Lyrics</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          placeholder="Paste or type your lyrics here…"
          style={{
            width: "100%",
            minHeight: 260,
            borderRadius: 12,
            padding: 12,
            font: "14px/1.5 system-ui, sans-serif",
            background: "#101010",
            color: "#eee",
            border: "1px solid #333"
          }}
        />
        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}></div>
      </section>
    </div>
  );
}

/* mount */
createRoot(document.getElementById("root")).render(<App />);
