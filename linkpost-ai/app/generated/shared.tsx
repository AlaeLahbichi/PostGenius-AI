"use client";

/**
 * Éléments partagés entre /generated (postes générés) et
 * /generated/deleted (postes supprimés) : accès API, types,
 * et briques visuelles reprises du template /post.
 */

export const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/generate";

export const C = {
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

export const GRAD = "linear-gradient(135deg, #2563eb, #8b5cf6)";

export type PostStatus = "brouillon" | "shared" | "supprime";

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
};

export const STATUS_META: Record<PostStatus, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: C.amber },
  shared: { label: "Partagé", color: C.green },
  supprime: { label: "Supprimé", color: C.red },
};

/* ------------------------------------------------------------------ */
/*  Accès API                                                           */
/* ------------------------------------------------------------------ */

export async function fetchGeneratedPosts(statuses: PostStatus[]): Promise<GeneratedPost[]> {
  const res = await fetch(`${API}/created?status=${statuses.join(",")}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Chargement impossible.");
  return json.posts || [];
}

// "shared" ne se met plus à jour directement — voir shareGeneratedPost,
// qui publie réellement sur LinkedIn avant de changer le statut.
export async function setPostStatus(id: string, status: Exclude<PostStatus, "shared">): Promise<void> {
  const res = await fetch(`${API}/created/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Mise à jour impossible.");
}

/**
 * Publie réellement le poste sur LinkedIn (texte + hashtags), puis marque
 * son statut "shared". Peut échouer (token expiré, scope manquant...) —
 * dans ce cas le statut reste inchangé côté serveur.
 */
export async function shareGeneratedPost(id: string): Promise<{ linkedinPostId: string | null }> {
  const res = await fetch(`${API}/created/${id}/share`, { method: "POST" });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Publication LinkedIn impossible.");
  return { linkedinPostId: json.linkedinPostId ?? null };
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
  busy,
}: {
  post: GeneratedPost;
  onClose: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

        <div style={{ background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
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

        {(onShare || onDelete) && (
          <>
            <Divider />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
          </>
        )}
      </div>
    </div>
  );
}
