"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "../../theme";
import {
  C,
  GeneratedPost,
  fetchGeneratedPosts,
  fmtDate,
  StatusBadge,
  PostDetailModal,
} from "../shared";

export default function DeletedGeneratedPostsPage() {
  const router = useRouter();

  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeneratedPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGeneratedPosts(["supprime"]);
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

  return (
    <div style={{ minHeight: "100vh", background: C.bgMain, color: C.textMain, fontFamily: "Inter, system-ui, sans-serif", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={32} textSize={14} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/generated")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.card, color: C.textMain, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            ← Retour aux postes générés
          </button>
        </div>

        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800 }}>Postes supprimés</h1>
        <p style={{ margin: "0 0 22px", color: C.textSecondary, fontSize: 14 }}>
          Postes générés que vous avez supprimés — visualisation uniquement.
        </p>

        {error && (
          <div style={{ background: "rgba(252,165,165,.1)", border: `1px solid ${C.red}55`, color: C.red, borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.textSecondary }}>Chargement…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.textSecondary, border: `1px dashed ${C.border}`, borderRadius: 18 }}>
            Aucun poste supprimé.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {posts.map((post) => (
              <div
                key={post._id}
                onClick={() => setSelected(post)}
                style={{ display: "flex", flexDirection: "column", gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <StatusBadge status={post.status} />
                  <span style={{ fontSize: 12, color: C.textSecondary }}>{fmtDate(post.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#e2e8f0", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {post.post_text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <PostDetailModal post={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
