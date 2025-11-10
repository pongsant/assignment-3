import { createRoot } from "react-dom/client";
import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ---- your data (no fetch) ---- */
import STREAMING_HISTORY from "./data/data.js";
import LYRICS from "./data/lyrics.js";

/* ---- import images dropped in /source/images ---- */
const importedImages = import.meta.glob("./images/*.{png,jpg,jpeg,webp}", { eager: true });
const IMAGE_BY_NAME = {};
for (const p in importedImages) {
  IMAGE_BY_NAME[p.split("/").pop().toLowerCase()] = importedImages[p].default;
}

/* ---- tiny hash router ---- */
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  React.useEffect(() => {
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
  return `https://picsum.photos/seed/${encodeURIComponent(artist)}/600/800`;
}

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
      spotifyUrl: trackUrl(best.id),
    });
  }
  top.sort((a, b) => b.artist.localeCompare(a.artist)); // diary order A→Z (feel free to change)
  return top.slice(0, 15);
}

/* ============================= */
/*              APP              */
/* ============================= */
function App() {
  const route = useRoute();
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
    return <SongDetail song={song} onBack={() => (location.hash = "#/")} />;
  }
  return <DiaryHome items={items} />;
}

/* ============================= */
/*    PAGE 1: DIARY / MAGAZINE   */
/* ============================= */
function DiaryHome({ items }) {
  // uniform stagger (clean, no overlap bugs)
  const delays = useMemo(
    () => items.map((_, i) => `${(i * 0.05).toFixed(2)}s`),
    [items.length]
  );

  return (
    <div className="wrap home">
      <header className="masthead">
        <h1>Song Diary</h1>
        <p className="dek">15 artists from my listening — click a page to read the entry & lyrics.</p>
      </header>

      {/* Editorial grid */}
      <ul className="diary-grid" aria-label="Song diary entries">
        {items.map((s, i) => (
          <li key={s.id} className="entry" style={{ "--delay": delays[i] }}>
            <button
              className="entry-card"
              onClick={() => (location.hash = `#/song/${encodeURIComponent(s.id)}`)}
              aria-label={`${s.artist} — ${s.title}`}
              title={`${s.artist} — ${s.title}`}
            >
              <img src={s.cover} alt={s.artist} />
              <div className="entry-meta">
                <span className="kicker">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="entry-artist">{s.artist}</h3>
                <p className="entry-title">{s.title}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================= */
/*   PAGE 2: SONG DETAIL (READ)  */
/* ============================= */
function SongDetail({ song, onBack }) {
  if (!song) {
    return (
      <div className="detail">
        <button className="back" onClick={onBack}>← Back</button>
        <p>Song not found.</p>
      </div>
    );
  }

  // lyrics come from source/data/lyrics.js (pre-filled in VS Code)
  const lyrics = LYRICS[song.id] || "";

  return (
    <div className="detail">
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
        <div className="lyrics-read" aria-label="Lyrics (read only)">
          {lyrics ? lyrics : "Add lyrics in source/data/lyrics.js for this track id."}
        </div>
      </section>
    </div>
  );
}

/* mount */
createRoot(document.getElementById("root")).render(<App />);
