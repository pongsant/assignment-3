import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SONGS } from "./data.js";   // <-- fixed path

const STORAGE_KEY = "song-buckets-v1";

export default function Song() {
  const { id } = useParams();
  const navigate = useNavigate();
  const song = useMemo(() => SONGS.find((s) => s.id === id), [id]);

  const [buckets, setBuckets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        Lyrics: [],
        Production: [],
        Vibe: []
      };
    } catch {
      return { Lyrics: [], Production: [], Vibe: [] };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
  }, [buckets]);

  if (!song) {
    return (
      <div className="app">
        <p className="p"><span className="back" onClick={() => navigate("/")}>← Back</span></p>
        <p>Song not found.</p>
      </div>
    );
  }

  function toggle(bucket) {
    setBuckets((prev) => {
      const set = new Set(prev[bucket]);
      if (set.has(song.id)) set.delete(song.id); else set.add(song.id);
      return { ...prev, [bucket]: Array.from(set) };
    });
  }

  const inB = (b) => buckets[b].includes(song.id);

  return (
    <div className="app">
      <p className="p"><span className="back" onClick={() => navigate("/")}>← Back</span></p>

      <div className="row">
        <img className="coverLg" src={song.cover} alt={song.title} />
        <div>
          <h1 className="h1" style={{ marginBottom: 6 }}>{song.title}</h1>
          <div className="p" style={{ margin: 0 }}>{song.artist}</div>
          {song.previewUrl ? (
            <audio src={song.previewUrl} controls style={{ marginTop: 8, width: 260 }} />
          ) : null}
        </div>
      </div>

      <div className="bins">
        {["Lyrics", "Production", "Vibe"].map((b) => (
          <div key={b} className="bin">
            <b>{b}</b>
            <div style={{ marginTop: 6 }}>
              {inB(b) ? <span className="tag">{song.title}</span> : <span className="small">Click “Add here” to include</span>}
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="tag" onClick={() => toggle(b)}>{inB(b) ? "Remove" : "Add here"}</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <h3 style={{ margin: "12px 0 8px" }}>Lyrics</h3>
        <div style={{ whiteSpace: "pre-wrap", background: "#121224", border: "1px solid #22223a", padding: 12, borderRadius: 12, lineHeight: 1.5 }}>
          {song.lyrics || "No lyrics available."}
        </div>
      </div>
    </div>
  );
}
