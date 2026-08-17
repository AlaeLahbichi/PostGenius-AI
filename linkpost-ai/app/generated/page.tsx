"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "../theme";
import {
  C,
  GRAD,
  GeneratedPost,
  fetchGeneratedPosts,
  setPostStatus,
  shareGeneratedPost,
  scheduleGeneratedPost,
  cancelGeneratedPostSchedule,
  fmtDate,
  StatusBadge,
  PostDetailModal,
  ScheduleInline,
} from "./shared";

type FilterValue = "all" | "brouillon" | "programme" | "shared";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "brouillon", label: "Brouillon" },
  { value: "programme", label: "Programmé" },
  { value: "shared", label: "Partagé" },
];

export default function GeneratedPostsPage() {
  const router = useRouter();

  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selected, setSelected] = useState<GeneratedPost | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGeneratedPosts(["brouillon", "programme", "shared"]);
      setPosts(data);
    } catch (e: any) {
      setError(e?.message || "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => p.status === filter)),
    [posts, filter]
  );

  async function handleShare(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await shareGeneratedPost(id); // publie réellement sur LinkedIn, puis marque "shared"
      setPosts((prev) => prev.map((p) => (p._id === id ? { ...p, status: "shared" } : p)));
      setSelected((s) => (s && s._id === id ? { ...s, status: "shared" } : s));
    } catch (e: any) {
      setError(e?.message || "Impossible de publier ce post sur LinkedIn.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await setPostStatus(id, "supprime");
      setPosts((prev) => prev.filter((p) => p._id !== id));
      setSelected((s) => (s && s._id === id ? null : s));
    } catch (e: any) {
      setError(e?.message || "Impossible de supprimer ce post.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSchedule(id: string, iso: string) {
    setBusyId(id);
    setError(null);
    try {
      await scheduleGeneratedPost(id, iso);
      setPosts((prev) => prev.map((p) => (p._id === id ? { ...p, status: "programme", scheduled_at: iso } : p)));
      setSelected((s) => (s && s._id === id ? { ...s, status: "programme", scheduled_at: iso } : s));
      setSchedulingId(null);
    } catch (e: any) {
      setError(e?.message || "Impossible de programmer ce post.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancelSchedule(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await cancelGeneratedPostSchedule(id);
      setPosts((prev) => prev.map((p) => (p._id === id ? { ...p, status: "brouillon", scheduled_at: null } : p)));
      setSelected((s) => (s && s._id === id ? { ...s, status: "brouillon", scheduled_at: null } : s));
    } catch (e: any) {
      setError(e?.message || "Impossible d'annuler la programmation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bgMain, color: C.textMain, fontFamily: "Inter, system-ui, sans-serif", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={32} textSize={14} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.card, color: C.textMain, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            ← Retour au dashboard
          </button>
          <button
            onClick={() => router.push("/generated/deleted")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            🗑️ Postes supprimés
          </button>
        </div>

        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800 }}>Postes générés</h1>
        <p style={{ margin: "0 0 22px", color: C.textSecondary, fontSize: 14 }}>
          Tous les postes générés par l'IA — brouillons et postes partagés.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                background: filter === f.value ? GRAD : "transparent",
                color: filter === f.value ? "#fff" : C.textSecondary,
                border: `1px solid ${filter === f.value ? "transparent" : C.border}`,
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(252,165,165,.1)", border: `1px solid ${C.red}55`, color: C.red, borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.textSecondary }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.textSecondary, border: `1px dashed ${C.border}`, borderRadius: 18 }}>
            Aucun poste généré pour l'instant.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {filtered.map((post) => (
              <div
                key={post._id}
                style={{ display: "flex", flexDirection: "column", gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <StatusBadge status={post.status} />
                  <span style={{ fontSize: 12, color: C.textSecondary }}>{fmtDate(post.created_at)}</span>
                </div>

                {post.status === "programme" && post.scheduled_at && (
                  <div style={{ fontSize: 12, color: C.blue }}>🕒 Programmé pour le {fmtDate(post.scheduled_at)}</div>
                )}

                <p
                  onClick={() => setSelected(post)}
                  style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#e2e8f0", cursor: "pointer", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {post.post_text}
                </p>

                {schedulingId === post._id ? (
                  <ScheduleInline
                    busy={busyId === post._id}
                    onCancel={() => setSchedulingId(null)}
                    onConfirm={(iso) => handleSchedule(post._id, iso)}
                  />
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setSelected(post)}
                      style={{ background: "transparent", color: C.cyan, border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                    >
                      Voir le détail
                    </button>
                    {post.status === "brouillon" && (
                      <>
                        <button
                          onClick={() => setSchedulingId(post._id)}
                          disabled={busyId === post._id}
                          style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: busyId === post._id ? "not-allowed" : "pointer", opacity: busyId === post._id ? 0.6 : 1 }}
                        >
                          Programmer
                        </button>
                        <button
                          onClick={() => handleShare(post._id)}
                          disabled={busyId === post._id}
                          style={{ background: GRAD, color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: busyId === post._id ? "not-allowed" : "pointer", opacity: busyId === post._id ? 0.6 : 1 }}
                        >
                          {busyId === post._id ? "Publication…" : "Publier sur LinkedIn"}
                        </button>
                      </>
                    )}
                    {post.status === "programme" && (
                      <button
                        onClick={() => handleCancelSchedule(post._id)}
                        disabled={busyId === post._id}
                        style={{ background: "transparent", color: C.amber, border: `1px solid ${C.amber}55`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: busyId === post._id ? "not-allowed" : "pointer", opacity: busyId === post._id ? 0.6 : 1 }}
                      >
                        Annuler la programmation
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post._id)}
                      disabled={busyId === post._id}
                      style={{ background: "transparent", color: C.red, border: `1px solid ${C.red}55`, borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: busyId === post._id ? "not-allowed" : "pointer", opacity: busyId === post._id ? 0.6 : 1 }}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <PostDetailModal
          post={selected}
          onClose={() => setSelected(null)}
          busy={busyId === selected._id}
          onShare={selected.status === "brouillon" ? () => handleShare(selected._id) : undefined}
          onSchedule={selected.status === "brouillon" ? (iso) => handleSchedule(selected._id, iso) : undefined}
          onCancelSchedule={selected.status === "programme" ? () => handleCancelSchedule(selected._id) : undefined}
          onDelete={() => handleDelete(selected._id)}
        />
      )}
    </div>
  );
}
