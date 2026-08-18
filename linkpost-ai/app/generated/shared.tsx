"use client";

/**
 * Éléments partagés entre /generated (postes générés) et
 * /generated/deleted (postes supprimés) : accès API, types,
 * et briques visuelles reprises du template /post.
 */

import { useEffect, useState } from "react";
import { C, GRAD } from "../theme";

export { C, GRAD };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
export const API = `${API_BASE}/generate`;
const OWNPOSTS_API = `${API_BASE}/ownposts`;

export type PostStatus = "brouillon" | "programme" | "shared" | "supprime";

export type GeneratedPost = {
  _id: string;
  objective?: string | null;
  audience?: string | null;
  cta?: string | null;
  length?: string | null;
  pattern?: string | null;
  hook?: string | null;
  angle?: string | null;
  styles?: string[];
  tones?: string[];
  formats?: string[];
  hashtags?: string[];
  mentions?: string[];
  post_text: string;
  status: PostStatus;
  created_at?: string;
  updated_at?: string;
  scheduled_at?: string | null;
  images?: { mime_type: string }[];
  own_post_id?: string | null;
  linked_at?: string | null;
  linkedin_post_id?: string | null;
};

export const STATUS_META: Record<PostStatus, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: C.amber },
  programme: { label: "Programmé", color: C.blue },
  shared: { label: "Partagé", color: C.green },
  supprime: { label: "Supprimé", color: C.red },
};

/* ------------------------------------------------------------------ */
/*  Accès API                                                           */
/* ------------------------------------------------------------------ */

/**
 * URLs des images jointes d'un poste (servies à la demande, une par
 * une — jamais incluses dans la liste, voir listCreatedPosts côté
 * backend), dans l'ordre où elles seront publiées.
 */
export function postImageUrls(post: Pick<GeneratedPost, "_id" | "images">): string[] {
  return (post.images || []).map((_, i) => `${API}/created/${post._id}/images/${i}`);
}

export async function fetchGeneratedPosts(statuses: PostStatus[]): Promise<GeneratedPost[]> {
  const res = await fetch(`${API}/created?status=${statuses.join(",")}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Chargement impossible.");
  return json.posts || [];
}

// "shared" et "programme" ne se mettent plus à jour directement — voir
// shareGeneratedPost / scheduleGeneratedPost.
export async function setPostStatus(id: string, status: Exclude<PostStatus, "shared" | "programme">): Promise<void> {
  const res = await fetch(`${API}/created/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Mise à jour impossible.");
}

/**
 * Publie réellement le poste sur LinkedIn (texte + hashtags + image jointe
 * éventuelle), puis marque son statut "shared". Peut échouer (token
 * expiré, scope manquant...) — dans ce cas le statut reste inchangé
 * côté serveur.
 */
export async function shareGeneratedPost(id: string): Promise<{ linkedinPostId: string | null }> {
  const res = await fetch(`${API}/created/${id}/share`, { method: "POST" });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Publication LinkedIn impossible.");
  return { linkedinPostId: json.linkedinPostId ?? null };
}

/**
 * Programme la publication d'un brouillon à une date/heure future. Le
 * serveur publie automatiquement le post une fois cette date atteinte
 * (voir publishScheduler.service.js côté backend).
 */
export async function scheduleGeneratedPost(id: string, scheduledAtIso: string): Promise<void> {
  const res = await fetch(`${API}/created/${id}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt: scheduledAtIso }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Programmation impossible.");
}

/**
 * Annule la programmation d'un poste (retour à "brouillon").
 */
export async function cancelGeneratedPostSchedule(id: string): Promise<void> {
  const res = await fetch(`${API}/created/${id}/schedule/cancel`, { method: "POST" });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Annulation impossible.");
}

export function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Valeur minimale exploitable par un <input type="datetime-local"> :
 * "maintenant + 5 min", au format local sans timezone.
 */
function minScheduleValue(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/*  Programmation (publication différée)                               */
/* ------------------------------------------------------------------ */

export function ScheduleInline({
  onConfirm,
  onCancel,
  busy,
}: {
  onConfirm: (iso: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState(minScheduleValue());

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      <input
        type="datetime-local"
        value={value}
        min={minScheduleValue()}
        onChange={(e) => setValue(e.target.value)}
        style={{ background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 10, color: C.textMain, padding: "7px 10px", fontSize: 12.5, outline: "none", fontFamily: "inherit" }}
      />
      <button
        onClick={() => value && onConfirm(new Date(value).toISOString())}
        disabled={busy || !value}
        style={{ background: GRAD, color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
      >
        Confirmer
      </button>
      <button
        onClick={onCancel}
        style={{ background: "transparent", color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
      >
        Annuler
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Boucle fermée : performances réelles d'un post reconcilié          */
/* ------------------------------------------------------------------ */

type OwnPostMetrics = {
  reactions?: number;
  comments?: number;
  shares?: number;
  total_interactions?: number;
  url?: string | null;
};

/**
 * Une fois qu'un post généré publié a été relié à sa version réellement
 * synchronisée (mes_postes) — voir postReconciliation.service.js côté
 * backend — ce composant affiche ses VRAIES performances, pour rendre
 * visible la boucle "généré avec ces caractéristiques -> voici le résultat".
 */
export function ReconciledStats({ ownPostId, linkedAt }: { ownPostId: string; linkedAt?: string | null }) {
  const [metrics, setMetrics] = useState<OwnPostMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${OWNPOSTS_API}/${encodeURIComponent(ownPostId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success) setMetrics(json.post || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownPostId]);

  if (loading) return null;
  if (!metrics) return null;

  return (
    <div style={{ background: "rgba(34,197,94,.08)", border: `1px solid ${C.green}55`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.green, marginBottom: 10 }}>
        ✓ Performances réelles{linkedAt ? ` (réconcilié le ${fmtDate(linkedAt)})` : ""}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Stat label="Interactions" value={metrics.total_interactions ?? 0} />
        <Stat label="Réactions" value={metrics.reactions ?? 0} />
        <Stat label="Commentaires" value={metrics.comments ?? 0} />
        <Stat label="Partages" value={metrics.shares ?? 0} />
      </div>
      {metrics.url && (
        <a href={metrics.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, color: C.cyan }}>
          Voir le post sur LinkedIn ↗
        </a>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.textMain }}>{value.toLocaleString("fr-FR")}</div>
      <div style={{ fontSize: 11, color: C.textSecondary }}>{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Briques visuelles (mêmes que le template /post)                     */
/* ------------------------------------------------------------------ */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.textSecondary }}>
        {label}
      </span>
      <div style={{ fontSize: 14, color: C.textMain }}>{children}</div>
    </div>
  );
}

export function Pills({ items, color }: { items?: string[]; color: string }) {
  if (!items || items.length === 0) return <span style={{ color: "#5b5178", fontSize: 13 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it, i) => (
        <span
          key={`${it}-${i}`}
          style={{ fontSize: 12.5, fontWeight: 600, color, background: `${color}1c`, borderRadius: 999, padding: "4px 10px" }}
        >
          {it}
        </span>
      ))}
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "2px 0" }} />;
}

export function StatusBadge({ status }: { status: PostStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{ fontSize: 12, fontWeight: 700, color: meta.color, background: `${meta.color}1c`, borderRadius: 999, padding: "4px 11px" }}
    >
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal de détail — même charte que le template /post                */
/* ------------------------------------------------------------------ */

export function PostDetailModal({
  post,
  onClose,
  onShare,
  onDelete,
  onSchedule,
  onCancelSchedule,
  busy,
}: {
  post: GeneratedPost;
  onClose: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onSchedule?: (iso: string) => void;
  onCancelSchedule?: () => void;
  busy?: boolean;
}) {
  const [scheduling, setScheduling] = useState(false);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,8,20,0.75)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: 26,
          maxWidth: 720,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <StatusBadge status={post.status} />
            <span style={{ fontSize: 12.5, color: C.textSecondary }}>{fmtDate(post.created_at)}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary, borderRadius: 10, padding: "6px 12px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {post.status === "programme" && post.scheduled_at && (
          <div style={{ background: "rgba(37,99,235,.1)", border: `1px solid ${C.blue}55`, borderRadius: 14, padding: 14, fontSize: 13.5, color: C.textMain }}>
            🕒 Publication programmée pour le <b>{fmtDate(post.scheduled_at)}</b>
          </div>
        )}

        {post.status === "shared" && post.own_post_id && (
          <ReconciledStats ownPostId={post.own_post_id} linkedAt={post.linked_at} />
        )}

        <div style={{ background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
          {postImageUrls(post).length === 1 && (
            <img
              src={postImageUrls(post)[0]}
              alt="Image jointe"
              style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, marginBottom: 14, border: `1px solid ${C.border}` }}
            />
          )}
          {postImageUrls(post).length > 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 14 }}>
              {postImageUrls(post).map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt={`Image ${i + 1} jointe`}
                  style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }}
                />
              ))}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#e2e8f0", whiteSpace: "pre-line" }}>
            {post.post_text}
          </p>
          {post.hashtags && post.hashtags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {post.hashtags.map((h) => (
                <span key={h} style={{ fontSize: 12.5, color: C.mauve, background: "rgba(168,85,247,.12)", borderRadius: 999, padding: "4px 10px" }}>
                  {h.startsWith("#") ? h : `#${h}`}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <Field label="Objectif">{post.objective || "—"}</Field>
          <Field label="Audience">{post.audience || "—"}</Field>
          <Field label="Appel à l'action">{post.cta || "—"}</Field>
          <Field label="Longueur">{post.length || "—"}</Field>
          <Field label="Pattern">{post.pattern || "—"}</Field>
          <Field label="Hook">{post.hook || "—"}</Field>
          <Field label="Angle d'attaque">{post.angle || "—"}</Field>
        </div>

        <Divider />
        <Field label="Style"><Pills items={post.styles} color={C.mauve} /></Field>
        <Field label="Ton"><Pills items={post.tones} color={C.green} /></Field>
        <Field label="Format"><Pills items={post.formats} color={C.cyan} /></Field>
        {post.mentions && post.mentions.length > 0 && (
          <Field label="Mentions"><Pills items={post.mentions} color={C.amber} /></Field>
        )}

        {(onShare || onDelete || onSchedule || onCancelSchedule) && (
          <>
            <Divider />
            {scheduling && onSchedule ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ScheduleInline
                  busy={busy}
                  onCancel={() => setScheduling(false)}
                  onConfirm={(iso) => {
                    onSchedule(iso);
                    setScheduling(false);
                  }}
                />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {onCancelSchedule && (
                  <button
                    onClick={onCancelSchedule}
                    disabled={busy}
                    style={{ background: "transparent", color: C.amber, border: `1px solid ${C.amber}55`, borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
                  >
                    Annuler la programmation
                  </button>
                )}
                {onSchedule && (
                  <button
                    onClick={() => setScheduling(true)}
                    disabled={busy}
                    style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
                  >
                    Programmer
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={onShare}
                    disabled={busy}
                    style={{ background: GRAD, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? "Publication…" : "Publier sur LinkedIn"}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    disabled={busy}
                    style={{ background: "transparent", color: C.red, border: `1px solid ${C.red}55`, borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
