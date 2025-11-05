import { createRoot } from "react-dom/client";
import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ========= Load all images dropped into source/images ========= */
const importedImages = import.meta.glob("./images/*.{png,jpg,jpeg,webp}", { eager: true });
const IMAGE_BY_NAME = {};
for (const p in importedImages) {
  const f = importedImages[p];
  IMAGE_BY_NAME[p.split("/").pop().toLowerCase()] = f.default;
}

/* ========= Simple hash router ========= */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const route = React.useMemo(() => {
    const parts = (hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
    if (parts.length === 0) return { name: "home" };
    if (parts[0] === "song" && parts[1]) return { name: "song", id: parts[1] };
    return { name: "home" };
  }, [hash]);
  const navigate = (to) => (window.location.hash = to.startsWith("#") ? to : `#${to}`);
  return { route, navigate };
}

/* ========= Local curation buckets ========= */
const BUCKETS = ["Lyrics", "Production", "Vibe"];
const loadCollections = () => {
  try { const raw = localStorage.getItem("collections"); if (raw) return JSON.parse(raw); } catch {}
  return { Lyrics: [], Production: [], Vibe: [] };
};
const saveCollections = (c) => localStorage.setItem("collections", JSON.stringify(c));

/* ========= Helpers for Spotify history rows ========= */
function parseTrackId(uri) {
  if (!uri) return "";
  const p = uri.split(":");
  return p[2] || uri;
}
function sanitize(s) { return String(s).toLowerCase().trim(); }

/* ========= MODE B: Only specific favorite artists ========= */
const USE_ARTIST_FILTER = true;

const ARTIST_WHITELIST = new Set([
  "frank ocean",
  "gavin:d",
  "drake",
  "travis scott",
  "justin bieber",
  "saran",
  "playboi carti",
  "three man down",
  "goreyard",
  "the weeknd",
  "tokio hotel",
]);

/* Artist → photo filename mapping */
const ARTIST_IMAGE_FILE = {
  "frank ocean": "frank_ocean.jpg",
  "gavin:d": "gavin_d.jpg",
  "drake": "drake.jpg",
  "travis scott": "travis_scott.jpg",
  "justin bieber": "justin_bieber.jpg",
  "saran": "saran.jpg",
  "playboi carti": "playboi_carti.jpg",
  "three man down": "three_man_down.jpg",
  "goreyard": "goreyard.jpg",
  "the weeknd": "the_weeknd.jpg",
  "tokio hotel": "tokio_hotel.jpg",
};

/* pick artist image or fallback */
function coverForArtist(artist) {
  const key = sanitize(artist);
  const filename = ARTIST_IMAGE_FILE[key];
  if (filename && IMAGE_BY_NAME[filename.toLowerCase()]) return IMAGE_BY_NAME[filename.toLowerCase()];
  return `https://picsum.photos/seed/${encodeURIComponent(key)}/300/300`;
}

/* aggregate → unique tracks; filter to whitelist; top 15 by ms_played */
function toTop15Filtered(rows) {
  const map = new Map();
  for (const r of rows) {
    const title = r.master_metadata_track_name;
    const artist = r.master_metadata_album_artist_name;
    if (!title || !artist) continue;
    if (USE_ARTIST_FILTER && !ARTIST_WHITELIST.has(sanitize(artist))) continue;

    const id = parseTrackId(r.spotify_track_uri) || `${title}::${artist}`;
    if (!map.has(id)) map.set(id, { id: String(id), title, artist, ms: 0, plays: 0 });
    const node = map.get(id);
    node.ms += Number(r.ms_played || 0);
    node.plays += 1;
  }
  const list = Array.from(map.values());
  list.sort((a, b) => b.ms - a.ms || b.plays - a.plays);
  return list.slice(0, 15).map((t) => ({ ...t, cover: coverForArtist(t.artist) }));
}

/* ========= App ========= */
function App() {
  const { route, navigate } = useHashRoute();
  const [collections, setCollections] = useState(loadCollections);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => saveCollections(collections), [collections]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        // Read YOUR JSON file directly from source/data/
        const res = await fetch("./data/Streaming_History_Audio_2024-2025.json", { headers: { "cache-control": "no-store" } });
        const raw = await res.json();
        const rows = Array.isArray(raw)
          ? raw.filter(r => r.master_metadata_track_name && r.master_metadata_album_artist_name)
          : [];
        const top15 = toTop15Filtered(rows);
        if (!stop) setSongs(top15);
      } catch {
        if (!stop) setSongs([]);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, []);

  const openSong = (id) => navigate(`#/song/${encodeURIComponent(String(id))}`);

  if (route.name === "song") {
    const song = songs.find((s) => String(s.id) === String(route.id));
    if (!song) return (
      <div className="detail" style={{ padding: 24 }}>
        <button className="back" onClick={() => navigate("#/")}>← Back</button>
        <p>Song not found.</p>
      </div>
    );
    return <SongDetail song={song} onBack={() => navigate("#/")} collections={collections} setCollections={setCollections} />;
  }

  return <Entrance songs={songs} loading={loading} openSong={openSong} />;
}

/* ========= Entrance (floating covers + portal) ========= */
function Entrance({ songs, loading, openSong }) {
  return (
    <div className="wrap">
      <header className="brand">
        <h1>Interactive Archive — Favorite Artists</h1>
        <p className="sub">
          {loading ? "Reading your streaming history…" : "Click a cover (or drag to the portal)"}
        </p>
      </header>

      <div className="portal"><div className="portal-hole" /></div>

      <ul className="float-field" aria-label="Floating album covers">
        {songs.map((s) => (
          <li key={s.id} className="float-card">
            <button className="album" onClick={() => openSong(s.id)} title={`${s.title} — ${s.artist}`}>
              <img src={s.cover} alt={`${s.artist}`} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========= Detail (with simple buckets via click) ========= */
function SongDetail({ song, onBack, collections, setCollections }) {
  const isIn = (b) => collections[b]?.includes(String(song.id));
  const add = (b) => setCollections((c) => isIn(b) ? c : { ...c, [b]: [...c[b], String(song.id)] });
  const remove = (b) => setCollections((c) => ({ ...c, [b]: c[b].filter((x) => x !== String(song.id)) }));

  return (
    <div className="detail" style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <button className="back" onClick={onBack}>← Back</button>

      <header className="song-head" style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, alignItems: "center", marginTop: 16 }}>
        <img src={song.cover} alt={`${song.artist}`} style={{ width: 160, height: 160, borderRadius: 18, objectFit: "cover" }} />
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{song.title}</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>{song.artist}</p>
        </div>
      </header>

      <section className="buckets" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 24 }}>
        {BUCKETS.map((b) => (
          <div key={b} className={`bucket ${isIn(b) ? "active" : ""}`} style={{ border: "1px solid #333", borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{b}</strong>
              {isIn(b) ? (
                <button onClick={() => remove(b)} className="remove">✕</button>
              ) : (
                <button onClick={() => add(b)} className="add">Add</button>
              )}
            </div>
            <p style={{ opacity: 0.7, marginTop: 8, fontSize: 14 }}>Click “Add” to place this song here.</p>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ========= Mount ========= */
const root = createRoot(document.getElementById("root"));
root.render(<App />);
