"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, C, GRAD } from "../theme";

/* ============================ Config ============================ */

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/concurrents";
const API_ANALYSE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/analyse-concurrent";
const REFRESH_INTERVAL = 300; // 5 min (test)

/* ============================ Types ============================ */

type Concurrent = { url: string; name: string | null; post_count: number; created_at?: string };
type Criteria = {
  minInteractions: number | null;
  minComments: number | null;
  startDate: string | null;
  endDate: string | null;
  count: number | null;
};
type Post = {
  id: string;
  concurrent_url?: string;
  url?: string;
  title?: string;
  headline?: string | null;
  post_text?: string;
  date_posted?: string;
  user_name?: string;
  user_profile_pic?: string;
  images?: string[] | null;
  videos?: string[] | null;
  video_thumbnail?: string | null;
  reactions?: number;
  comments?: number;
  total_interactions?: number;
};

/* ============================ Helpers UI ============================ */

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "number",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140, flex: 1 }}>
      <label style={{ fontSize: 12, color: C.textSecondary }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: C.bgSecondary,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          color: C.textMain,
          padding: "9px 12px",
          fontSize: 14,
          outline: "none",
        }}
      />
    </div>
  );
}

/* ---- Carrousel médias (images + vidéos) d'un post ---- */

type MediaItem = { type: "image"; src: string } | { type: "video"; src: string; poster?: string };

function PostMedia({ post }: { post: Post }) {
  const media: MediaItem[] = [
    ...((post.videos ?? []).map((src) => ({ type: "video", src, poster: post.video_thumbnail ?? undefined })) as MediaItem[]),
    ...((post.images ?? []).map((src) => ({ type: "image", src })) as MediaItem[]),
  ];

  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  // Pas de média : placeholder texte pour garder des cartes homogènes.
  if (media.length === 0) {
    return (
      <div
        style={{
          height: 150,
          borderRadius: 14,
          background: "linear-gradient(135deg,#16112b,#201a3a)",
          border: `1px solid ${C.border}`,
          display: "grid",
          placeItems: "center",
          color: "#6a5d8f",
          fontSize: 13,
          letterSpacing: 0.3,
        }}
      >
        Publication texte
      </div>
    );
  }

  const wrap = (i: number) => (i + media.length) % media.length;
  const go = (i: number) => setIndex(wrap(i));

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  const cur = media[index];

  return (
    <div
      className="pg-media"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: "relative", width: "100%", height: 300, borderRadius: 14, overflow: "hidden", background: "#000", border: `1px solid ${C.border}` }}
    >
      {/* Piste qui glisse */}
      <div className="pg-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {media.map((m, i) => (
          <div className="pg-slide" key={m.src + i}>
            {m.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.src} alt={post.title ?? "post"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <video src={m.src} poster={m.poster} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            )}
          </div>
        ))}
      </div>

      {/* Dégradés haut/bas pour la lisibilité des badges & points */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.4), rgba(0,0,0,0) 24%, rgba(0,0,0,0) 72%, rgba(0,0,0,.45))" }} />

      {cur.type === "video" && <span style={mediaBadge("left")}>▶ Vidéo</span>}
      {media.length > 1 && <span style={mediaBadge("right")}>{index + 1}/{media.length}</span>}

      {media.length > 1 && (
        <>
          <button className="pg-nav" onClick={() => go(index - 1)} aria-label="Média précédent" style={mediaNav("left")}>‹</button>
          <button className="pg-nav" onClick={() => go(index + 1)} aria-label="Média suivant" style={mediaNav("right")}>›</button>

          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Média ${i + 1}`}
                className="pg-dot"
                style={{
                  width: i === index ? 20 : 6,
                  height: 6,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  background: i === index ? C.cyan : "rgba(248,250,252,.45)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function mediaBadge(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    [side]: 10,
    background: "rgba(0,0,0,.6)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 999,
    backdropFilter: "blur(4px)",
    zIndex: 2,
  } as React.CSSProperties;
}

function mediaNav(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 10,
    transform: "translateY(-50%)",
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,.16)",
    background: "rgba(5,8,20,.55)",
    color: "#fff",
    fontSize: 20,
    lineHeight: "32px",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
    zIndex: 2,
  } as React.CSSProperties;
}

/* ---- Carte d'un post ---- */

function PostCard({
  post,
  onAnalyser,
  analyzed,
  analyzing,
}: {
  post: Post;
  onAnalyser: (post: Post) => void;
  analyzed: boolean;
  analyzing: boolean;
}) {
  const date = post.date_posted
    ? new Date(post.date_posted).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const initial = (post.user_name || "?").trim().charAt(0).toUpperCase();
  const router = useRouter();

  return (
    <div className="pg-card" style={{ display: "flex", flexDirection: "column", background: C.card, border: `1px solid ${analyzed ? "rgba(34,197,94,.35)" : C.border}`, borderRadius: 18, overflow: "hidden" }}>
      {/* Entête auteur */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 12px" }}>
        {post.user_profile_pic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.user_profile_pic} alt={post.user_name ?? ""} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.border}` }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: GRAD, display: "grid", placeItems: "center", fontWeight: 700, color: "#fff", fontSize: 15 }}>{initial}</div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {post.user_name || "Auteur inconnu"}
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary }}>{date}</div>
        </div>
        {analyzed && (
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: "rgba(34,197,94,.14)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 999, padding: "3px 9px" }}>
            ✓ Analysé
          </span>
        )}
      </div>

      {/* Média */}
      <div style={{ padding: "0 16px" }}>
        <PostMedia post={post} />
      </div>

      {/* Texte */}
      {post.post_text && (
        <p style={{ margin: "14px 16px 0", fontSize: 14, lineHeight: 1.55, color: "#dbe4f0", whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {post.post_text}
        </p>
      )}

      {/* Métriques */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 16px 0" }}>
        <Metric icon="♥" value={post.reactions ?? 0} color={C.mauve} />
        <Metric icon="💬" value={post.comments ?? 0} color={C.cyan} />
        <Metric icon="↗" value={post.total_interactions ?? 0} color={C.green} label="interactions" />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, padding: 16, marginTop: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => router.push(`/post?id=${encodeURIComponent(post.id)}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.cyan, background: "transparent", border: `1px solid ${C.cyan}`, borderRadius: 10, padding: "9px 14px", cursor: "pointer" }}
        >
          Voir détail
        </button>

        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", fontSize: 13, color: C.textSecondary, textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px" }}
          >
            LinkedIn ↗
          </a>
        )}

        <button
          onClick={() => onAnalyser(post)}
          disabled={analyzing}
          className="pg-analyse"
          style={{
            flex: 1,
            minWidth: 130,
            background: analyzing ? C.border : analyzed ? "transparent" : GRAD,
            color: analyzed && !analyzing ? C.green : "#fff",
            border: analyzed && !analyzing ? `1px solid ${C.green}` : "none",
            borderRadius: 10,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: analyzing ? "not-allowed" : "pointer",
            opacity: analyzing ? 0.7 : 1,
          }}
        >
          {analyzing ? "⟳ Analyse…" : analyzed ? "Ré-analyser" : "✦ Analyser"}
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, value, color, label }: { icon: string; value: number; color: string; label?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 600,
        color,
        background: `${color}14`,
        border: `1px solid ${color}2b`,
        borderRadius: 999,
        padding: "5px 10px",
      }}
    >
      <span aria-hidden>{icon}</span>
      {value.toLocaleString("fr-FR")}
      {label && <span style={{ color: C.textSecondary, fontWeight: 400 }}>{label}</span>}
    </span>
  );
}

/* ============================ Page ============================ */

export default function ConcurrentsPage() {
  const [concurrents, setConcurrents] = useState<Concurrent[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [criteria, setCriteria] = useState<Criteria>({
    minInteractions: null,
    minComments: null,
    startDate: null,
    endDate: null,
    count: null,
  });

  const [autoImport, setAutoImport] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL);

  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  /* -------- Bouton Analyser : analyse UN post spécifique -------- */
  async function handleAnalyser(post: Post) {
    if (analyzingId) return;
    setAnalyzingId(post.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_ANALYSE}/${encodeURIComponent(post.id)}`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Analyse impossible.");
        return;
      }
      setNotice(json.skipped ? "Ce post était déjà analysé." : "Analyse enregistrée.");
      await loadAnalyzed();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'analyse.");
    } finally {
      setAnalyzingId(null);
    }
  }

  /* -------- Bouton Analyser tout : analyse TOUS les posts, un par un -------- */
  async function handleAnalyserGlobale() {
    if (analyzingAll) return;
    setAnalyzingAll(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_ANALYSE}/all`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Analyse globale impossible.");
        return;
      }
      setNotice(`Analyse globale : ${json.analyzed} analysé(s), ${json.skipped} déjà fait(s), ${json.failed} échec(s).`);
      await loadAnalyzed();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'analyse globale.");
    } finally {
      setAnalyzingAll(false);
    }
  }

  /* ---------- Chargements ---------- */

  const loadConcurrents = useCallback(async () => {
    try {
      const res = await fetch(API);
      const json = await res.json();
      setConcurrents(json.concurrents || []);
    } catch (e: any) {
      setError(`Backend injoignable (${API}). ${e?.message || ""}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/posts`);
      const json = await res.json();
      setPosts(json.posts || []);
    } catch {
      /* best-effort */
    }
  }, []);

  const loadCriteria = useCallback(async () => {
    try {
      const res = await fetch(`${API}/criteria`);
      const json = await res.json();
      if (json.criteria) setCriteria(json.criteria);
    } catch {
      /* best-effort */
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(`${API}/schedule/status`);
      const s = await res.json();
      setAutoImport(!!s.running);
      if (s.running && typeof s.secondsLeft === "number") setSecondsLeft(s.secondsLeft);
    } catch {
      /* best-effort */
    }
  }, []);

  const loadAnalyzed = useCallback(async () => {
    try {
      const res = await fetch(API_ANALYSE);
      const json = await res.json();
      const ids: string[] = (json.analyses || []).map((a: any) => a.post_id).filter(Boolean);
      setAnalyzedIds(new Set(ids));
    } catch {
      /* best-effort */
    }
  }, []);

  const actionsRef = useRef({ loadConcurrents, loadPosts, loadSchedule, loadAnalyzed });
  actionsRef.current = { loadConcurrents, loadPosts, loadSchedule, loadAnalyzed };

  useEffect(() => {
    loadConcurrents();
    loadPosts();
    loadCriteria();
    loadSchedule();
    loadAnalyzed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        actionsRef.current.loadSchedule();
        actionsRef.current.loadConcurrents();
        actionsRef.current.loadPosts();
        actionsRef.current.loadAnalyzed();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!autoImport) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          actionsRef.current.loadConcurrents();
          actionsRef.current.loadPosts();
          actionsRef.current.loadSchedule();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [autoImport]);

  /* ---------- Actions ---------- */

  const addConcurrent = async () => {
    setError(null);
    setNotice(null);
    if (!url.trim()) return;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Ajout impossible.");
        return;
      }
      setUrl("");
      setNotice(json.inserted ? "Concurrent ajouté." : "Concurrent déjà présent.");
      await loadConcurrents();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'ajout.");
    }
  };

  const removeConcurrent = async (u: string) => {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API}?url=${encodeURIComponent(u)}`, { method: "DELETE" });
      const json = await res.json();
      setNotice(`Concurrent supprimé — ${json.deletedPosts ?? 0} poste(s) retiré(s).`);
      await loadConcurrents();
      await loadPosts();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la suppression.");
    }
  };

  const importNow = async () => {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API}/import`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setNotice(`Import terminé : ${json.totalImported} nouveau(x), ${json.totalUpdated} mis à jour.`);
      } else {
        setError(json.message || "Import impossible.");
      }
      await loadConcurrents();
      await loadPosts();
      await loadSchedule();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'import.");
    } finally {
      setImporting(false);
    }
  };

  const toggleAuto = async () => {
    try {
      if (autoImport) {
        await fetch(`${API}/schedule/stop`, { method: "POST" });
        setAutoImport(false);
      } else {
        const res = await fetch(`${API}/schedule/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: REFRESH_INTERVAL / 60 }),
        });
        const s = await res.json();
        setAutoImport(true);
        setSecondsLeft(typeof s.secondsLeft === "number" ? s.secondsLeft : REFRESH_INTERVAL);
      }
    } catch (e: any) {
      setError(e?.message || "Planificateur injoignable.");
    }
  };

  const saveCriteria = async () => {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API}/criteria`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const json = await res.json();
      if (json.criteria) setCriteria(json.criteria);
      setNotice("Critères d'import enregistrés.");
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement.");
    }
  };

  const setCrit = (k: keyof Criteria) => (v: string) =>
    setCriteria((c) => ({ ...c, [k]: v === "" ? null : k === "startDate" || k === "endDate" ? v : Number(v) }));

  const str = (v: number | string | null) => (v === null || v === undefined ? "" : String(v));

  /* ============================ Rendu ============================ */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bgMain,
        color: C.textMain,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "28px clamp(16px, 4vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <style>{`
          .pg-card { transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
          .pg-card:hover { transform: translateY(-3px); border-color: #3d3160; box-shadow: 0 16px 34px -18px rgba(0,0,0,.75); }
          .pg-media { touch-action: pan-y; }
          .pg-track { display: flex; height: 100%; transition: transform .42s cubic-bezier(.22,.61,.36,1); }
          .pg-slide { flex: 0 0 100%; width: 100%; height: 100%; }
          .pg-nav { opacity: 0; transition: opacity .2s ease, background .2s ease; }
          .pg-media:hover .pg-nav { opacity: 1; }
          .pg-nav:hover { background: rgba(5,8,20,.82); }
          .pg-dot { transition: width .25s ease, background .25s ease; }
          .pg-analyse { transition: filter .18s ease, transform .1s ease; }
          .pg-analyse:hover { filter: brightness(1.09); }
          .pg-analyse:active { transform: scale(.985); }
          @media (hover: none) { .pg-nav { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) {
            .pg-card, .pg-track, .pg-nav, .pg-dot, .pg-analyse { transition: none !important; }
          }
        `}</style>
        <div style={{ marginBottom: 22 }}>
          <Logo size={32} textSize={14} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: GRAD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>P</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Concurrents</div>
              <div style={{ color: C.textSecondary, fontSize: 13 }}>Import de leurs publications</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: autoImport ? C.green : C.textSecondary, boxShadow: autoImport ? `0 0 10px ${C.green}` : "none" }} />
              <span style={{ color: C.textSecondary, fontSize: 12 }}>{autoImport ? "Prochain import" : "Auto désactivé"}</span>
              <b style={{ color: autoImport ? C.cyan : C.textSecondary, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                {autoImport ? mmss(secondsLeft) : "--:--"}
              </b>
            </div>

            <button
              onClick={toggleAuto}
              style={{ background: autoImport ? C.bgSecondary : "transparent", color: autoImport ? C.textMain : C.textSecondary, border: `1px solid ${autoImport ? C.blue : C.border}`, borderRadius: 12, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
            >
              {autoImport ? "⏸ Stop auto" : "▶ Auto (5 min)"}
            </button>

            <button
              onClick={importNow}
              disabled={importing}
              style={{ background: importing ? C.border : GRAD, color: C.textMain, border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1 }}
            >
              {importing ? "⟳ Import…" : "⟳ Importer maintenant"}
            </button>
          </div>
        </div>

        {notice && <Card style={{ marginBottom: 16, borderColor: C.green }}><span style={{ color: C.green }}>✓ {notice}</span></Card>}
        {error && <Card style={{ marginBottom: 16, borderColor: C.red }}><span style={{ color: C.red }}>⚠ {error}</span></Card>}

        {/* Ajout d'un concurrent */}
        <Card style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10 }}>Ajouter un concurrent (URL de profil LinkedIn)</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addConcurrent()}
              placeholder="https://www.linkedin.com/in/…"
              style={{ flex: 1, minWidth: 260, background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textMain, padding: "11px 14px", fontSize: 14, outline: "none" }}
            />
            <button onClick={addConcurrent} style={{ background: GRAD, color: C.textMain, border: "none", borderRadius: 12, padding: "11px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              + Ajouter
            </button>
          </div>
        </Card>

        {/* Critères d'import */}
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Critères d'import</div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>Laisse un champ vide = aucune limite (tout).</div>
            </div>
            <button onClick={saveCriteria} style={{ background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}`, borderRadius: 12, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              Enregistrer
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field label="Interactions min." value={str(criteria.minInteractions)} onChange={setCrit("minInteractions")} placeholder="all" />
            <Field label="Commentaires min." value={str(criteria.minComments)} onChange={setCrit("minComments")} placeholder="all" />
            <Field label="Date début" type="date" value={str(criteria.startDate)} onChange={setCrit("startDate")} />
            <Field label="Date fin" type="date" value={str(criteria.endDate)} onChange={setCrit("endDate")} />
            <Field label="Count (limite)" value={str(criteria.count)} onChange={setCrit("count")} placeholder="all" />
          </div>
        </Card>

        {/* Liste des concurrents */}
        <Card style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            Concurrents suivis {concurrents.length > 0 && <span style={{ color: C.textSecondary, fontWeight: 400 }}>· {concurrents.length}</span>}
          </div>

          {loading ? (
            <span style={{ color: C.textSecondary }}>Chargement…</span>
          ) : concurrents.length === 0 ? (
            <span style={{ color: C.textSecondary }}>Aucun concurrent pour l'instant. Ajoute une URL ci-dessus.</span>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {concurrents.map((c) => (
                <div
                  key={c.url}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <a href={c.url} target="_blank" rel="noreferrer" style={{ color: C.textMain, fontSize: 14, textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 600 }}>
                      {c.url}
                    </a>
                    <div style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }}>{c.post_count} poste(s) importé(s)</div>
                  </div>
                  <button
                    onClick={() => removeConcurrent(c.url)}
                    title="Supprimer ce concurrent et ses posts"
                    style={{ background: "transparent", color: C.red, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Posts importés */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Publications importées</h2>
            {posts.length > 0 && <span style={{ color: C.textSecondary, fontSize: 14 }}>· {posts.length}</span>}
          </div>

          {posts.length > 0 && (
            <button
              onClick={handleAnalyserGlobale}
              disabled={analyzingAll}
              style={{ background: analyzingAll ? C.border : GRAD, color: C.textMain, border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: analyzingAll ? "not-allowed" : "pointer", opacity: analyzingAll ? 0.7 : 1 }}
            >
              {analyzingAll ? "⟳ Analyse en cours…" : "✦ Analyser tout"}
            </button>
          )}
        </div>

        {posts.length === 0 ? (
          <Card><span style={{ color: C.textSecondary }}>Aucune publication importée. Ajoute des concurrents puis clique « Importer maintenant ».</span></Card>
        ) : (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onAnalyser={handleAnalyser}
                analyzed={analyzedIds.has(p.id)}
                analyzing={analyzingId === p.id || analyzingAll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}