"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "../theme";

/* ============================ Config ============================ */

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/concurrents";
const API_ANALYSE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/analyse-concurrent";
const API_OWNPOSTS = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/ownposts";

/* ============================ Charte ============================ */

const C = {
  bgMain: "#0d0a1a",
  bgSecondary: "#16112b",
  card: "#1c1533",
  border: "#2f2650",
  textMain: "#f8fafc",
  textSecondary: "#a79bc4",
  blue: "#2563eb",
  cyan: "#38bdf8",
  violet: "#8b5cf6",
  mauve: "#a855f7",
  green: "#22c55e",
  amber: "#fbbf24",
  red: "#fca5a5",
};
const GRAD = "linear-gradient(135deg, #2563eb, #8b5cf6)";

/* ============================ Types ============================ */

type Post = {
  id: string;
  concurrent_url?: string;
  url?: string;
  title?: string;
  headline?: string | null;
  post_text?: string;
  post_type?: string;
  date_posted?: string;
  user_name?: string;
  user_profile_pic?: string;
  user_followers?: number;
  hashtags?: string[] | null;
  images?: string[] | null;
  videos?: string[] | null;
  video_thumbnail?: string | null;
  reactions?: number;
  comments?: number;
  shares?: number;
  total_interactions?: number;
};

type Analysis = {
  post_id?: string | null;
  post_url?: string | null;
  format?: string | null;
  explication_format?: string | null;
  type_post?: string | null;
  explication_type_post?: string | null;
  style?: string[];
  explication_style?: string | null;
  angle_attaque?: string | null;
  explication_angle_attaque?: string | null;
  hook?: string | null;
  hook_type?: string | null;
  explication_hook?: string | null;
  pattern?: string | null;
  explication_pattern?: string | null;
  ton?: string[];
  explication_ton?: string | null;
  structure?: string[];
  explication_structure?: string | null;
  outils?: string[];
  explication_outils?: string | null;
  appel_action?: string | null;
  explication_appel_action?: string | null;
  resume?: string | null;
  explication_resume?: string | null;
  mots_cles?: string[];
  explication_mots_cles?: string | null;
  metrics?: { total_interactions?: number; num_likes?: number; num_comments?: number };
};

/* ============================ Carrousel médias ============================ */

type MediaItem = { type: "image"; src: string } | { type: "video"; src: string; poster?: string };

function PostMedia({ post, height = 440 }: { post: Post; height?: number }) {
  const media: MediaItem[] = [
    ...((post.videos ?? []).map((src) => ({ type: "video", src, poster: post.video_thumbnail ?? undefined })) as MediaItem[]),
    ...((post.images ?? []).map((src) => ({ type: "image", src })) as MediaItem[]),
  ];

  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  if (media.length === 0) return null;

  const wrap = (i: number) => (i + media.length) % media.length;
  const go = (i: number) => setIndex(wrap(i));

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
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
      style={{ position: "relative", width: "100%", height, borderRadius: 16, overflow: "hidden", background: "#000", border: `1px solid ${C.border}` }}
    >
      <div className="pg-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {media.map((m, i) => (
          <div className="pg-slide" key={m.src + i}>
            {m.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.src} alt={post.title ?? "post"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            ) : (
              <video src={m.src} poster={m.poster} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.35), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 74%, rgba(0,0,0,.45))" }} />

      {cur.type === "video" && <span style={mediaBadge("left")}>▶ Vidéo</span>}
      {media.length > 1 && <span style={mediaBadge("right")}>{index + 1}/{media.length}</span>}

      {media.length > 1 && (
        <>
          <button className="pg-nav" onClick={() => go(index - 1)} aria-label="Média précédent" style={mediaNav("left")}>‹</button>
          <button className="pg-nav" onClick={() => go(index + 1)} aria-label="Média suivant" style={mediaNav("right")}>›</button>
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {media.map((_, i) => (
              <button key={i} onClick={() => go(i)} aria-label={`Média ${i + 1}`} className="pg-dot"
                style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 999, border: "none", cursor: "pointer", padding: 0, background: i === index ? C.cyan : "rgba(248,250,252,.45)" }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function mediaBadge(side: "left" | "right"): React.CSSProperties {
  return { position: "absolute", top: 12, [side]: 12, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, backdropFilter: "blur(4px)", zIndex: 2 } as React.CSSProperties;
}
function mediaNav(side: "left" | "right"): React.CSSProperties {
  return { position: "absolute", top: "50%", [side]: 12, transform: "translateY(-50%)", width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,.16)", background: "rgba(5,8,20,.55)", color: "#fff", fontSize: 20, lineHeight: "34px", cursor: "pointer", backdropFilter: "blur(6px)", zIndex: 2 } as React.CSSProperties;
}

/* ============================ Briques d'affichage ============================ */

function Metric({ icon, value, color, label }: { icon: string; value: number; color: string; label?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}2b`, borderRadius: 999, padding: "6px 12px" }}>
      <span aria-hidden>{icon}</span>
      {value.toLocaleString("fr-FR")}
      {label && <span style={{ color: C.textSecondary, fontWeight: 400 }}>{label}</span>}
    </span>
  );
}

function Pills({ items, color }: { items?: string[]; color: string }) {
  if (!items || items.length === 0) return <span style={{ color: "#5b5178", fontSize: 13 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it, i) => (
        <span key={`${it}-${i}`} style={{ fontSize: 12.5, fontWeight: 600, color, background: `${color}1c`, borderRadius: 999, padding: "4px 10px" }}>{it}</span>
      ))}
    </div>
  );
}

function Field({ label, children, explanation }: { label: string; children: React.ReactNode; explanation?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.textSecondary }}>{label}</span>
      <div style={{ fontSize: 14, color: C.textMain }}>{children}</div>
      {explanation && <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.textSecondary }}>{explanation}</p>}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "2px 0" }} />;
}

/* ============================ Contenu ============================ */

function PostDetail() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  // "own" = poste personnel (mes_postes, via /ownposts) ; sinon poste concurrent.
  const source = useSearchParams().get("source") === "own" ? "own" : "concurrent";

  const [post, setPost] = useState<Post | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError("Aucun identifiant de post dans l'URL.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (source === "own") {
          // Poste personnel : récupéré directement par id, pas d'analyse
          // concurrentielle associée (elle ne s'applique qu'aux concurrents).
          const res = await fetch(`${API_OWNPOSTS}/${encodeURIComponent(String(id))}`);
          const json = await res.json();
          if (!res.ok || !json.success || !json.post) {
            throw new Error(json.message || "Post introuvable. Il a peut-être été supprimé.");
          }
          if (!cancelled) setPost(json.post);
        } else {
          // 1) Récupérer le post par son id (dans les posts importés).
          const resPosts = await fetch(`${API}/posts`);
          const jp = await resPosts.json();
          const found: Post | undefined = (jp.posts || []).find((p: Post) => String(p.id) === String(id));
          if (!found) throw new Error("Post introuvable. Il a peut-être été supprimé lors d'un ré-import.");
          if (!cancelled) setPost(found);

          // 2) Récupérer l'analyse si elle existe (404 = pas encore analysé).
          try {
            const resA = await fetch(`${API_ANALYSE}/${encodeURIComponent(String(id))}`);
            if (resA.ok) {
              const ja = await resA.json();
              if (!cancelled && ja.success) setAnalysis(ja.analysis);
            }
          } catch {
            /* best-effort */
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, source]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(source === "own" ? "/posts" : "/concurrent");
  };

  /* ---------- États ---------- */

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "120px 0", color: C.textSecondary }}>
        <div className="spin" style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.cyan }} />
        <span>Chargement du post…</span>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="fade-in" style={{ maxWidth: 460, margin: "80px auto", textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "36px 28px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Impossible d'afficher ce post</div>
        <p style={{ color: C.textSecondary, fontSize: 14, margin: "0 0 18px" }}>{error ?? "Post introuvable."}</p>
        <button onClick={goBack} style={{ background: GRAD, color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          ← Retour
        </button>
      </div>
    );
  }

  const date = post.date_posted
    ? new Date(post.date_posted).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const initial = (post.user_name || "?").trim().charAt(0).toUpperCase();
  const interactions = post.total_interactions ?? (post.reactions || 0) + (post.comments || 0);

  return (
    <div className="fade-in">
      {/* Barre haute */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <button
          onClick={goBack}
          className="back-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.card, color: C.textMain, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >
          ← Retour
        </button>

        {post.url && (
          <a href={post.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textSecondary, textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px" }}>
            Voir sur LinkedIn ↗
          </a>
        )}
      </div>

      <div className="detail-grid">
        {/* ---------- Colonne post ---------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Auteur */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
            {post.user_profile_pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.user_profile_pic} alt={post.user_name ?? ""} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.border}` }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: GRAD, display: "grid", placeItems: "center", fontWeight: 700, color: "#fff", fontSize: 18 }}>{initial}</div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{post.user_name || "Auteur inconnu"}</div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {date && <span>{date}</span>}
                {typeof post.user_followers === "number" && <span>{post.user_followers.toLocaleString("fr-FR")} abonnés</span>}
                {post.post_type && <span style={{ textTransform: "capitalize" }}>{post.post_type}</span>}
              </div>
            </div>
          </div>

          {/* Média */}
          <PostMedia post={post} />

          {/* Texte + hashtags */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {post.headline && <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}>{post.headline}</h1>}
            {post.post_text ? (
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#e2e8f0", whiteSpace: "pre-line" }}>{post.post_text}</p>
            ) : (
              <p style={{ margin: 0, color: C.textSecondary }}>Aucun texte pour cette publication.</p>
            )}

            {post.hashtags && post.hashtags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {post.hashtags.map((h) => (
                  <span key={h} style={{ fontSize: 12.5, color: C.mauve, background: "rgba(168,85,247,.12)", borderRadius: 999, padding: "4px 10px" }}>
                    {h.startsWith("#") ? h : `#${h}`}
                  </span>
                ))}
              </div>
            )}

            {/* Métriques */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
              <Metric icon="♥" value={post.reactions ?? 0} color={C.mauve} label="réactions" />
              <Metric icon="💬" value={post.comments ?? 0} color={C.cyan} label="commentaires" />
              {typeof post.shares === "number" && <Metric icon="↻" value={post.shares} color={C.amber} label="partages" />}
              <Metric icon="↗" value={interactions} color={C.green} label="interactions" />
            </div>
          </div>
        </div>

        {/* ---------- Colonne analyse / détails ---------- */}
        <div style={{ position: "relative" }}>
          <div className="analysis-sticky" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#2563eb,#a855f7)", display: "grid", placeItems: "center", color: "#fff", fontSize: 15 }}>{source === "own" ? "ℹ" : "✦"}</div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{source === "own" ? "Détails de la publication" : "Analyse du post"}</h2>
            </div>

            {source === "own" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Type de post">{post.post_type || "—"}</Field>
                <Divider />
                <Field label="Auteur">{post.user_name || "—"}</Field>
                {typeof post.user_followers === "number" && (
                  <Field label="Abonnés">{post.user_followers.toLocaleString("fr-FR")}</Field>
                )}
                <Divider />
                <Field label="Publié le">{date || "—"}</Field>
                {post.url && (
                  <Field label="Lien LinkedIn">
                    <a href={post.url} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>
                      Ouvrir la publication ↗
                    </a>
                  </Field>
                )}
              </div>
            ) : !analysis ? (
              <div style={{ background: C.bgSecondary, border: `1px dashed ${C.border}`, borderRadius: 14, padding: "22px 18px", textAlign: "center", color: C.textSecondary, fontSize: 13.5, lineHeight: 1.6 }}>
                Ce post n'a pas encore été analysé.
                <br />
                Lance l'analyse depuis la page des concurrents.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {analysis.format && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.blue, background: "rgba(37,99,235,.16)", borderRadius: 999, padding: "5px 11px" }}>{analysis.format}</span>}
                  {analysis.type_post && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.cyan, background: "rgba(56,189,248,.16)", borderRadius: 999, padding: "5px 11px" }}>{analysis.type_post}</span>}
                </div>

                {analysis.resume && <Field label="Résumé" explanation={analysis.explication_resume}><span style={{ lineHeight: 1.6 }}>{analysis.resume}</span></Field>}

                {analysis.hook && (
                  <>
                    <Divider />
                    <Field label="Hook" explanation={analysis.explication_hook}>
                      <span style={{ fontStyle: "italic", color: "#e2e8f0" }}>« {analysis.hook} »</span>
                      {analysis.hook_type && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: C.mauve, background: "rgba(168,85,247,.16)", borderRadius: 999, padding: "3px 9px" }}>{analysis.hook_type}</span>}
                    </Field>
                  </>
                )}

                {analysis.pattern && (
                  <>
                    <Divider />
                    <Field label="Pattern" explanation={analysis.explication_pattern}><span style={{ fontWeight: 700, color: C.mauve }}>{analysis.pattern}</span></Field>
                  </>
                )}

                {analysis.angle_attaque && (
                  <>
                    <Divider />
                    <Field label="Angle d'attaque" explanation={analysis.explication_angle_attaque}><span style={{ fontWeight: 600 }}>{analysis.angle_attaque}</span></Field>
                  </>
                )}

                <Divider />
                <Field label="Style" explanation={analysis.explication_style}><Pills items={analysis.style} color={C.mauve} /></Field>
                <Field label="Ton" explanation={analysis.explication_ton}><Pills items={analysis.ton} color={C.green} /></Field>

                {analysis.structure && analysis.structure.length > 0 && (
                  <>
                    <Divider />
                    <Field label="Structure" explanation={analysis.explication_structure}>
                      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                        {analysis.structure.map((step, i) => (
                          <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                            <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "rgba(37,99,235,.16)", color: "#60a5fa", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </Field>
                  </>
                )}

                {analysis.outils && analysis.outils.length > 0 && (
                  <>
                    <Divider />
                    <Field label="Outils / technologies" explanation={analysis.explication_outils}><Pills items={analysis.outils} color={C.cyan} /></Field>
                  </>
                )}

                <Divider />
                <Field label="Appel à l'action" explanation={analysis.explication_appel_action}>{analysis.appel_action ?? "Aucun"}</Field>

                {analysis.mots_cles && analysis.mots_cles.length > 0 && (
                  <>
                    <Divider />
                    <Field label="Mots-clés" explanation={analysis.explication_mots_cles}><Pills items={analysis.mots_cles} color={C.amber} /></Field>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Page ============================ */

export default function PostPage() {
  return (
    <div style={{ minHeight: "100vh", background: C.bgMain, color: C.textMain, fontFamily: "Inter, system-ui, sans-serif", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <style>{`
        .fade-in { animation: fadeUp .4s ease both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .detail-grid { display: grid; gap: 20px; grid-template-columns: 1fr; align-items: start; max-width: 1120px; margin: 0 auto; }
        @media (min-width: 920px) { .detail-grid { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); } }
        .analysis-sticky { position: static; }
        @media (min-width: 920px) { .analysis-sticky { position: sticky; top: 24px; } }
        .pg-media { touch-action: pan-y; }
        .pg-track { display: flex; height: 100%; transition: transform .42s cubic-bezier(.22,.61,.36,1); }
        .pg-slide { flex: 0 0 100%; width: 100%; height: 100%; }
        .pg-nav { opacity: 0; transition: opacity .2s ease, background .2s ease; }
        .pg-media:hover .pg-nav { opacity: 1; }
        .pg-nav:hover { background: rgba(5,8,20,.82); }
        .pg-dot { transition: width .25s ease, background .25s ease; }
        .back-btn { transition: border-color .18s ease, transform .1s ease; }
        .back-btn:hover { border-color: #3d3160; }
        .back-btn:active { transform: scale(.98); }
        @media (hover: none) { .pg-nav { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .fade-in, .pg-track, .pg-nav, .pg-dot, .back-btn, .spin { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={32} textSize={14} />
        </div>
        <Suspense
          fallback={
            <div style={{ display: "flex", justifyContent: "center", padding: "120px 0", color: C.textSecondary }}>Chargement…</div>
          }
        >
          <PostDetail />
        </Suspense>
      </div>
    </div>
  );
}