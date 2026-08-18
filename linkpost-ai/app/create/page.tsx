"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, C, GRAD } from "../theme";
import { ScheduleInline } from "../generated/shared";

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/generate";

type Val = { value: string; slug: string; usage_count: number; post_count: number };
type Reco = { value: string; reason: string };
type RPost = { id: string; url?: string | null; user_name?: string | null; interactions: number; text: string };
type RelEntry = { value: string; posts: RPost[] };

type Selections = {
  objective: string;
  audience: string;
  cta: string;
  length: string;
  pattern: string;
  hook: string;
  angle: string;
  styles: string[];
  tones: string[];
  formats: string[];
};


const STEPS = [
  { n: 1, title: "Objectif", keys: [] as string[] },
  { n: 2, title: "Pattern", keys: ["pattern"] },
  { n: 3, title: "Hook", keys: ["hook"] },
  { n: 4, title: "Angle", keys: ["angle"] },
  { n: 5, title: "Style & Ton", keys: ["style", "tone"] },
  { n: 6, title: "Format", keys: ["format"] },
  { n: 7, title: "Génération", keys: [] },
];
const TOTAL = STEPS.length;

const DIM_LABEL: Record<string, string> = {
  pattern: "Pattern",
  hook: "Type de hook",
  angle: "Angle d'attaque",
  style: "Style",
  tone: "Ton",
  format: "Format",
};
const MULTI: Record<string, boolean> = { pattern: false, hook: false, angle: false, style: true, tone: true, format: true };
const SEL_FIELD: Record<string, keyof Selections> = { pattern: "pattern", hook: "hook", angle: "angle", style: "styles", tone: "tones", format: "formats" };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22, ...style }}>{children}</div>;
}

function PostSnippet({ p }: { p: RPost }) {
  return (
    <div style={{ background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textMain, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.user_name || "Auteur"}</span>
        <span style={{ fontSize: 11.5, color: C.cyan, flexShrink: 0 }}>{p.interactions.toLocaleString("fr-FR")} int.</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: C.textSecondary, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.text}</p>
    </div>
  );
}

function ChoiceStep({
  dimKey,
  values,
  recos,
  selected,
  onToggle,
  related,
}: {
  dimKey: string;
  values: Val[];
  recos: Reco[];
  selected: string[];
  onToggle: (v: string) => void;
  related: RelEntry[];
}) {
  const isSel = (v: string) => selected.includes(v);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{DIM_LABEL[dimKey]}</div>
        <div style={{ fontSize: 13, color: C.textSecondary }}>
          {MULTI[dimKey] ? "Choisis une ou plusieurs valeurs." : "Choisis une valeur."}
        </div>
      </div>

      {/* Recommandations IA */}
      {recos.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, rgba(37,99,235,.12), rgba(124,58,237,.12))", border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>✦ Recommandé pour ton objectif</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {recos.map((r) => (
              <button
                key={r.value}
                onClick={() => onToggle(r.value)}
                style={{ textAlign: "left", background: isSel(r.value) ? GRAD : C.card, color: isSel(r.value) ? "#fff" : C.textMain, border: `1px solid ${isSel(r.value) ? "transparent" : C.blue}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.value}</div>
                <div style={{ fontSize: 12, color: isSel(r.value) ? "rgba(255,255,255,.85)" : C.textSecondary, lineHeight: 1.45 }}>{r.reason}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {}
      <div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 10 }}>Toutes les valeurs disponibles</div>
        {values.length === 0 ? (
          <div style={{ color: C.textSecondary, fontSize: 13 }}>Aucune valeur : analyse d'abord des posts pour remplir cette dimension.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {values.map((v) => (
              <button
                key={v.slug}
                onClick={() => onToggle(v.value)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: isSel(v.value) ? GRAD : C.bgSecondary, color: isSel(v.value) ? "#fff" : C.textSecondary, border: `1px solid ${isSel(v.value) ? "transparent" : C.border}`, borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {v.value}
                <span style={{ fontSize: 11, opacity: 0.7 }}>{v.usage_count}×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {}
      {related.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 10 }}>
            Posts utilisant {MULTI[dimKey] ? "ces critères" : "ce critère"} (inclus dans la génération)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {related.map((entry) => (
              <div key={entry.value}>
                {MULTI[dimKey] && <div style={{ fontSize: 12.5, fontWeight: 700, color: C.mauve, marginBottom: 8 }}>{entry.value}</div>}
                {entry.posts.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: C.textSecondary }}>Aucun post lié.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                    {entry.posts.map((p) => (
                      <PostSnippet key={p.id} p={p} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export default function GeneratePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState<Selections>({
    objective: "",
    audience: "",
    cta: "",
    length: "moyen",
    pattern: "",
    hook: "",
    angle: "",
    styles: [],
    tones: [],
    formats: [],
  });

  const [valuesByKey, setValuesByKey] = useState<Record<string, Val[]>>({});
  const [recosByKey, setRecosByKey] = useState<Record<string, Reco[]>>({});
  const [relatedByKey, setRelatedByKey] = useState<Record<string, RelEntry[]>>({});
  const [loadingStep, setLoadingStep] = useState(false);

  const [generated, setGenerated] = useState("");
  const [genMeta, setGenMeta] = useState<{ relatedCount: number; examplesUsed: number; voiceExamplesUsed: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<{ base64: string; mimeType: string; name: string }[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  const stepDef = STEPS[step - 1];

  /* ---------- Chargement des données d'une étape ---------- */

  const fetchRelated = useCallback(async (key: string, value: string): Promise<RPost[]> => {
    try {
      const res = await fetch(`${API}/related?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`);
      const json = await res.json();
      return json.posts || [];
    } catch {
      return [];
    }
  }, []);

  const ensureStepData = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      setLoadingStep(true);
      try {
        for (const key of keys) {
          // valeurs
          if (!valuesByKey[key]) {
            const res = await fetch(`${API}/values/${key}`);
            const json = await res.json();
            setValuesByKey((m) => ({ ...m, [key]: json.values || [] }));
          }
          // recommandations
          if (!recosByKey[key] && sel.objective.trim()) {
            const res = await fetch(`${API}/recommend`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ objective: sel.objective, key }),
            });
            const json = await res.json();
            setRecosByKey((m) => ({ ...m, [key]: json.recommendations || [] }));
          }
        }
      } finally {
        setLoadingStep(false);
      }
    },
    [valuesByKey, recosByKey, sel.objective]
  );

  useEffect(() => {
    ensureStepData(stepDef.keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Génération auto à l'entrée de la dernière étape.
  useEffect(() => {
    if (step === TOTAL && !generated && !generating) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ---------- Sélection ---------- */

  async function toggle(key: string, value: string) {
    const field = SEL_FIELD[key];
    const multi = MULTI[key];

    if (!multi) {
      const already = (sel[field] as string) === value;
      setSel((s) => ({ ...s, [field]: already ? "" : value }));
      if (already) {
        setRelatedByKey((r) => ({ ...r, [key]: [] }));
      } else {
        const posts = await fetchRelated(key, value);
        setRelatedByKey((r) => ({ ...r, [key]: [{ value, posts }] }));
      }
      return;
    }

    const arr = sel[field] as string[];
    const has = arr.includes(value);
    setSel((s) => ({ ...s, [field]: has ? arr.filter((x) => x !== value) : [...arr, value] }));

    if (has) {
      setRelatedByKey((r) => ({ ...r, [key]: (r[key] || []).filter((e) => e.value !== value) }));
    } else {
      const posts = await fetchRelated(key, value);
      setRelatedByKey((r) => ({ ...r, [key]: [...(r[key] || []), { value, posts }] }));
    }
  }

  const selectedFor = (key: string): string[] => {
    const field = SEL_FIELD[key];
    const v = sel[field];
    return Array.isArray(v) ? v : v ? [v] : [];
  };

  /* ---------- Génération / sauvegarde ---------- */

  async function generate() {
    setGenerating(true);
    setError(null);
    setNotice(null);
    setSaved(false);
    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: sel.objective,
          audience: sel.audience,
          cta: sel.cta,
          length: sel.length,
          pattern: sel.pattern,
          hook: sel.hook,
          angle: sel.angle,
          styles: sel.styles,
          tones: sel.tones,
          formats: sel.formats,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Génération impossible.");
        return;
      }
      setGenerated(json.post_text || "");
      setGenMeta({ relatedCount: json.relatedCount || 0, examplesUsed: json.examplesUsed || 0, voiceExamplesUsed: json.voiceExamplesUsed || 0 });
    } catch (e: any) {
      setError(e?.message || "Erreur de génération.");
    } finally {
      setGenerating(false);
    }
  }

  const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
  // LinkedIn refuse (PROCESSING_FAILED, silencieusement jusqu'ici) les
  // images trop grandes : constaté en réel qu'un carré 6250×6250 échoue
  // et que 2500×2500 passe. On redimensionne donc côté navigateur, avec
  // une marge de sécurité, plutôt que de forcer l'utilisateur à le faire
  // à la main.
  const MAX_IMAGE_DIMENSION = 2000;
  // Alignée sur la limite LinkedIn pour un post multi-images (voir aussi
  // MAX_IMAGES_PER_POST côté backend, linkedinPublish.service.js).
  const MAX_IMAGES = 10;

  /**
   * Redimensionne l'image si l'un de ses côtés dépasse MAX_IMAGE_DIMENSION
   * (ratio conservé), via un <canvas>. Ne touche pas aux images déjà dans
   * les clous — pas de perte de qualité inutile.
   */
  function resizeImageIfNeeded(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const { width, height } = img;
          if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
            const base64 = String(reader.result || "").split(",")[1] || "";
            resolve({ base64, mimeType: file.type });
            return;
          }
          const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Impossible de traiter cette image."));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // PNG conservé pour garder la transparence (captures d'écran…),
          // sinon JPEG (plus léger pour une photo).
          const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
          const base64 = canvas.toDataURL(mimeType, 0.9).split(",")[1] || "";
          resolve({ base64, mimeType });
        };
        img.onerror = () => reject(new Error("Image invalide ou corrompue."));
        img.src = String(reader.result || "");
      };
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // permet de resélectionner les mêmes fichiers après suppression
    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images par post (${images.length} déjà jointe${images.length > 1 ? "s" : ""}).`);
      return;
    }
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Chaque fichier joint doit être une image.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`Image trop volumineuse : ${file.name} (4,5 Mo max).`);
        return;
      }
    }
    setError(null);
    try {
      const processed = await Promise.all(
        files.map(async (file) => {
          const { base64, mimeType } = await resizeImageIfNeeded(file);
          return { base64, mimeType, name: file.name };
        })
      );
      setImages((prev) => [...prev, ...processed]);
    } catch (err: any) {
      setError(err?.message || "Impossible de traiter une de ces images.");
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Enregistre le brouillon, puis selon `mode` : le laisse en brouillon,
   * le publie immédiatement sur LinkedIn, ou le programme pour plus tard.
   * L'enregistrement lui-même se fait toujours en brouillon côté serveur.
   */
  async function save(mode: "draft" | "publish" | "schedule", scheduledAtIso?: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: sel.objective,
          audience: sel.audience,
          cta: sel.cta,
          length: sel.length,
          pattern: sel.pattern,
          hook: sel.hook,
          angle: sel.angle,
          styles: sel.styles,
          tones: sel.tones,
          formats: sel.formats,
          post_text: generated,
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Sauvegarde impossible.");
        return;
      }

      if (mode === "draft") {
        setNotice("Post enregistré en brouillon.");
        setSaved(true);
        return;
      }

      if (mode === "schedule" && scheduledAtIso) {
        const scheduleRes = await fetch(`${API}/created/${json.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledAt: scheduledAtIso }),
        });
        const scheduleJson = await scheduleRes.json();
        if (!scheduleJson.success) {
          setError(
            `Post enregistré en brouillon, mais la programmation a échoué : ${scheduleJson.message || "erreur inconnue."}`
          );
          setSaved(true);
          return;
        }
        setNotice(`Post programmé pour le ${new Date(scheduledAtIso).toLocaleString("fr-FR")}.`);
        setSaved(true);
        setShowSchedule(false);
        return;
      }

      // "Partager" = publication réelle sur LinkedIn, puis passage en "shared".
      const shareRes = await fetch(`${API}/created/${json.id}/share`, { method: "POST" });
      const shareJson = await shareRes.json();
      if (!shareJson.success) {
        setError(
          `Post enregistré en brouillon, mais la publication LinkedIn a échoué : ${shareJson.message || "erreur inconnue."}`
        );
        setSaved(true);
        return;
      }

      setNotice("Post publié sur LinkedIn !");
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "Erreur de sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Validation « Suivant » ---------- */

  const canNext = useMemo(() => {
    switch (step) {
      case 1:
        return sel.objective.trim().length > 0;
      case 2:
        return !!sel.pattern;
      case 3:
        return !!sel.hook;
      case 4:
        return !!sel.angle;
      case 5:
        return sel.styles.length > 0 && sel.tones.length > 0;
      case 6:
        return sel.formats.length > 0;
      default:
        return true;
    }
  }, [step, sel]);

  const progress = (step / TOTAL) * 100;

  /* ============================ Rendu ============================ */

  return (
    <div style={{ minHeight: "100vh", background: C.bgMain, color: C.textMain, fontFamily: "Inter, system-ui, sans-serif", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <style>{`
        .gen-bar-fill { transition: width .5s cubic-bezier(.22,.61,.36,1); }
        .gen-dot { transition: background .3s ease, color .3s ease, border-color .3s ease; }
        textarea::-webkit-scrollbar { width: 8px; } textarea::-webkit-scrollbar-thumb { background: #2f2650; border-radius: 8px; }
        @media (prefers-reduced-motion: reduce) { .gen-bar-fill { transition: none; } }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={32} textSize={14} />
        </div>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: GRAD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>✦</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Générer un post</h1>
            <div style={{ color: C.textSecondary, fontSize: 13 }}>Étape {step} sur {TOTAL} — {stepDef.title}</div>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: "hidden", marginBottom: 14 }}>
          <div className="gen-bar-fill" style={{ height: "100%", width: `${progress}%`, background: GRAD }} />
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, gap: 4 }}>
          {STEPS.map((s) => {
            const done = s.n < step;
            const active = s.n === step;
            return (
              <div key={s.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <div className="gen-dot" style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: active ? GRAD : done ? "rgba(34,197,94,.16)" : C.card, color: active ? "#fff" : done ? C.green : C.textSecondary, border: `1px solid ${active ? "transparent" : done ? "rgba(34,197,94,.4)" : C.border}` }}>
                  {done ? "✓" : s.n}
                </div>
                <span style={{ fontSize: 10.5, color: active ? C.textMain : C.textSecondary, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{s.title}</span>
              </div>
            );
          })}
        </div>

        {notice && <Card style={{ marginBottom: 16, borderColor: C.green, padding: 16 }}><span style={{ color: C.green }}>✓ {notice}</span></Card>}
        {error && <Card style={{ marginBottom: 16, borderColor: C.red, padding: 16 }}><span style={{ color: C.red }}>⚠ {error}</span></Card>}

        {/* Contenu de l'étape */}
        <Card style={{ minHeight: 260 }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Objectif du post</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>Décris ce que ce post doit accomplir. C'est la base des recommandations IA.</div>
              </div>
              <textarea
                value={sel.objective}
                onChange={(e) => setSel((s) => ({ ...s, objective: e.target.value }))}
                placeholder="Ex : Annoncer notre nouvelle offre de rénovation énergétique et générer des demandes de devis auprès des propriétaires en Alsace."
                rows={4}
                style={{ width: "100%", background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 12, color: C.textMain, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>
                  <label style={{ fontSize: 12, color: C.textSecondary }}>Audience cible (optionnel)</label>
                  <input value={sel.audience} onChange={(e) => setSel((s) => ({ ...s, audience: e.target.value }))} placeholder="Ex : propriétaires de maisons individuelles" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.textSecondary }}>Intention / appel à l'action (optionnel)</label>
                  <input value={sel.cta} onChange={(e) => setSel((s) => ({ ...s, cta: e.target.value }))} placeholder="Ex : demander un devis gratuit" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {step >= 2 && step <= 6 &&
            (loadingStep && stepDef.keys.some((k) => !valuesByKey[k]) ? (
              <div style={{ color: C.textSecondary, padding: "40px 0", textAlign: "center" }}>Chargement des critères…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {stepDef.keys.map((key) => (
                  <ChoiceStep
                    key={key}
                    dimKey={key}
                    values={valuesByKey[key] || []}
                    recos={recosByKey[key] || []}
                    selected={selectedFor(key)}
                    onToggle={(v) => toggle(key, v)}
                    related={relatedByKey[key] || []}
                  />
                ))}
              </div>
            ))}

          {step === 7 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>Post généré</div>
                  <div style={{ fontSize: 12.5, color: C.textSecondary }}>
                    {genMeta
                      ? `${genMeta.examplesUsed} exemples utilisés · ${genMeta.relatedCount} posts liés${genMeta.voiceExamplesUsed > 0 ? ` · calqué sur ta voix (${genMeta.voiceExamplesUsed} de tes posts)` : ""}`
                      : "Basé sur tes choix et les posts liés."}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={sel.length} onChange={(e) => setSel((s) => ({ ...s, length: e.target.value }))} style={{ ...inputStyle, width: "auto", marginTop: 0 }}>
                    <option value="court">Court</option>
                    <option value="moyen">Moyen</option>
                    <option value="long">Long</option>
                  </select>
                  <button onClick={generate} disabled={generating} style={{ background: generating ? C.border : C.bgSecondary, color: C.textMain, border: `1px solid ${C.blue}`, borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer" }}>
                    {generating ? "⟳ Génération…" : "⟳ Regénérer"}
                  </button>
                </div>
              </div>

              {generating ? (
                <div style={{ color: C.textSecondary, padding: "50px 0", textAlign: "center" }}>Rédaction du post en cours…</div>
              ) : (
                <textarea
                  value={generated}
                  onChange={(e) => {
                    setGenerated(e.target.value);
                    if (saved) setSaved(false);
                  }}
                  rows={14}
                  placeholder="Le post généré apparaîtra ici (éditable)."
                  style={{ width: "100%", background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 12, color: C.textMain, padding: "14px 16px", fontSize: 14.5, lineHeight: 1.7, outline: "none", resize: "vertical", fontFamily: "inherit", whiteSpace: "pre-wrap" }}
                />
              )}

              {/* Images jointes (optionnelles, jusqu'à MAX_IMAGES) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: images.length >= MAX_IMAGES ? C.border : C.bgSecondary,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: "9px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.textMain,
                      cursor: images.length >= MAX_IMAGES ? "not-allowed" : "pointer",
                      opacity: images.length >= MAX_IMAGES ? 0.6 : 1,
                    }}
                  >
                    📷 {images.length > 0 ? `Ajouter des images (${images.length}/${MAX_IMAGES})` : "Joindre des images"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={images.length >= MAX_IMAGES}
                      onChange={handleImageChange}
                      style={{ display: "none" }}
                    />
                  </label>
                  {images.length > 0 && (
                    <span style={{ fontSize: 12, color: C.textSecondary }}>
                      {images.length} image{images.length > 1 ? "s" : ""} jointe{images.length > 1 ? "s" : ""} — publiées dans cet ordre
                    </span>
                  )}
                </div>
                {images.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {images.map((img, i) => (
                      <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                        <img
                          src={`data:${img.mimeType};base64,${img.base64}`}
                          alt={img.name}
                          style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }}
                        />
                        <button
                          onClick={() => removeImage(i)}
                          title="Retirer cette image"
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: C.red,
                            color: "#fff",
                            border: "none",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: "20px",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {showSchedule ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ScheduleInline busy={saving} onCancel={() => setShowSchedule(false)} onConfirm={(iso) => save("schedule", iso)} />
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                  {saved && (
                    <button
                      onClick={() => router.push("/dashboard")}
                      style={{ marginRight: "auto", background: C.card, color: C.cyan, border: `1px solid ${C.cyan}`, borderRadius: 12, padding: "11px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                    >
                      ← Retour au dashboard
                    </button>
                  )}
                  <button onClick={() => save("draft")} disabled={saving || !generated.trim()} style={{ background: "transparent", color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 12, padding: "11px 20px", fontWeight: 700, fontSize: 14, cursor: saving || !generated.trim() ? "not-allowed" : "pointer", opacity: !generated.trim() ? 0.5 : 1 }}>
                    Enregistrer en brouillon
                  </button>
                  <button onClick={() => setShowSchedule(true)} disabled={saving || !generated.trim()} style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 12, padding: "11px 20px", fontWeight: 700, fontSize: 14, cursor: saving || !generated.trim() ? "not-allowed" : "pointer", opacity: !generated.trim() ? 0.5 : 1 }}>
                    Programmer
                  </button>
                  <button onClick={() => save("publish")} disabled={saving || !generated.trim()} style={{ background: GRAD, color: "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, fontSize: 14, cursor: saving || !generated.trim() ? "not-allowed" : "pointer", opacity: !generated.trim() ? 0.5 : 1 }}>
                    {saving ? "Publication…" : "Publier sur LinkedIn"}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 12 }}>
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            style={{ background: C.card, color: step === 1 ? C.textSecondary : C.textMain, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 20px", fontWeight: 600, fontSize: 14, cursor: step === 1 ? "not-allowed" : "pointer", opacity: step === 1 ? 0.5 : 1 }}
          >
            ← Retour
          </button>

          {step < TOTAL && (
            <button
              onClick={() => canNext && setStep((s) => Math.min(TOTAL, s + 1))}
              disabled={!canNext}
              style={{ background: canNext ? GRAD : C.border, color: "#fff", border: "none", borderRadius: 12, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.6 }}
            >
              Suivant →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "#16112b",
  border: "1px solid #2f2650",
  borderRadius: 10,
  color: "#f8fafc",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};