"use client";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, C, GRAD as GRAD_BLUE_VIOLET, GRAD_BLUE_MAUVE, GRAD_CYAN_MAUVE } from "../theme";
import {
  type Snapshot,
  type Granularity,
  type SeriesPoint,
  GRANULARITIES,
  fmtNum,
  fmtDate,
  mmss,
  bucketizeSeries,
  timeFormatter,
} from "./timeseries";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  Legend,
} from "recharts";

/* ============================ Config ============================ */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
const DEFAULT_PROFILE = "https://www.linkedin.com/in/lahbichi-alae/";
const REFRESH_INTERVAL = 300; // 5 min (test)

/* ============================ Charte : voir ../theme.tsx ============================ */


/* ============================ Types ============================ */

type Post = {
  id: string;
  title?: string;
  url?: string;
  date_posted?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
  total_interactions?: number;
  history?: Snapshot[];
  [k: string]: any;
};

type GlobalStats = {
  kpis: {
    totalPosts: number;
    totalInteractions: number;
    totalReactions: number;
    totalComments: number;
    totalShares: number;
    avgInteractions: number;
    bestPost: { id: string; title: string; total_interactions: number } | null;
  };
  topPosts: Array<{ id: string; title: string; total_interactions: number }>;
  timeseries: Snapshot[];
};

/* ---------- Repères de changement de jour (à insérer dans un graphe) ---------- */

// Renvoie un tableau de <ReferenceLine> pour chaque changement de jour.
// (Fonction simple, PAS un composant : Recharts ne traverse pas les
//  composants personnalisés, mais aplatit bien les tableaux d'éléments.)
function renderDayDividers(data: SeriesPoint[]) {
  return data
    .filter((p) => p.dayChange)
    .map((p) => (
      <ReferenceLine
        key={p.key}
        x={p.key}
        stroke={C.mauve}
        strokeDasharray="4 4"
        className="day-divider"
        label={{ value: p.dayLabel, position: "insideTop", fill: C.mauve, fontSize: 10 }}
      />
    ));
}

/* ============================ UI atoms ============================ */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: C.cyan,
        border: `1px solid ${C.border}`,
        borderRadius: 999,
        padding: "4px 10px",
        marginBottom: 12,
      }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  gradient = GRAD_BLUE_VIOLET,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  gradient?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? C.border : gradient,
        color: C.textMain,
        border: "none",
        borderRadius: 12,
        padding: "10px 18px",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "transform .12s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.bgSecondary : "transparent",
        color: active ? C.textMain : C.textSecondary,
        border: `1px solid ${active ? C.blue : C.border}`,
        borderRadius: 12,
        padding: "9px 16px",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function KpiCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: accent,
          filter: "blur(38px)",
          opacity: 0.35,
        }}
      />
      <div style={{ color: C.textSecondary, fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div style={{ color: C.textMain, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: C.textSecondary, fontSize: 12, marginTop: 8 }}>{sub}</div>}
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p0 = payload[0]?.payload;
  const shownLabel =
    p0 && p0.isHour
      ? p0.dayStart
        ? `${p0.dayLabel} · ${p0.time}`
        : p0.time
      : p0?.t ?? label;
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        color: C.textMain,
        fontSize: 12,
      }}
    >
      <div style={{ color: C.textSecondary, marginBottom: 6 }}>{shownLabel}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span>{p.name} :</span>
          <b>{fmtNum(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

/* ============================ Page ============================ */

export default function Page() {
  const [profileUrl, setProfileUrl] = useState(DEFAULT_PROFILE);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tab, setTab] = useState<"global" | "post" | "compare">("global");
  const [selectedId, setSelectedId] = useState<string>("");
  const [cmpA, setCmpA] = useState<string>("");
  const [cmpB, setCmpB] = useState<string>("");

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL);

  const [detailPost, setDetailPost] = useState<Post | null>(null);

  const [granularity, setGranularity] = useState<Granularity>("hour");

  const [linkedinDaysRemaining, setLinkedinDaysRemaining] = useState<number | null>(null);

  /* ---------- Chargement des données ---------- */

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [postsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/ownposts`),
        fetch(`${API_BASE}/ownposts/stats/global`),
      ]);
      const postsJson = await postsRes.json();
      const statsJson = await statsRes.json();

      const loadedPosts: Post[] = postsJson.posts || [];
      setPosts(loadedPosts);
      setStats(statsJson || null);

      if (loadedPosts.length && !selectedId) setSelectedId(loadedPosts[0].id);
      if (loadedPosts.length >= 2) {
        if (!cmpA) setCmpA(loadedPosts[0].id);
        if (!cmpB) setCmpB(loadedPosts[1].id);
      }
    } catch (e: any) {
      setError(`Impossible de contacter le backend (${API_BASE}). ${e?.message || ""}`);
    } finally {
      setLoading(false);
    }
  }, [selectedId, cmpA, cmpB]);

  /* ---------- État du planificateur serveur ---------- */

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ownposts/schedule/status`);
      const s = await res.json();
      setAutoRefresh(!!s.running);
      if (s.running && typeof s.secondsLeft === "number") {
        setSecondsLeft(s.secondsLeft);
      }
    } catch {
      /* silencieux : le serveur n'est peut-être pas encore prêt */
    }
  }, []);

  /* ---------- Synchronisation (collecte LinkedIn) ---------- */

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/ownposts/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl }),
      });
      const json = await res.json();

      if (json.async) {
        setNotice("Collecte Bright Data en cours… Relancez dans quelques instants.");
      } else if (json.success) {
        setNotice(
          `Synchronisé : ${json.totalFetched ?? 0} poste(s) — ` +
            `${json.inserted ?? 0} ajouté(s), ${json.updated ?? 0} mis à jour.`
        );
      } else {
        setError(json.message || "Échec de la synchronisation.");
      }

      await loadData();
      await loadSchedule();
    } catch (e: any) {
      setError(`Erreur de synchronisation : ${e?.message || ""}`);
    } finally {
      setSyncing(false);
    }
  }, [profileUrl, loadData, loadSchedule]);

  /* ---------- Activer / désactiver l'auto-sync serveur ---------- */

  const toggleAuto = useCallback(async () => {
    try {
      if (autoRefresh) {
        await fetch(`${API_BASE}/ownposts/schedule/stop`, { method: "POST" });
        setAutoRefresh(false);
      } else {
        const res = await fetch(`${API_BASE}/ownposts/schedule/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileUrl, minutes: REFRESH_INTERVAL / 60 }),
        });
        const s = await res.json();
        setAutoRefresh(true);
        setSecondsLeft(typeof s.secondsLeft === "number" ? s.secondsLeft : REFRESH_INTERVAL);
      }
    } catch (e: any) {
      setError(`Impossible de contacter le planificateur : ${e?.message || ""}`);
    }
  }, [autoRefresh, profileUrl]);

  // Réf stable pour déclencher un rafraîchissement depuis le minuteur
  // sans recréer l'intervalle à chaque render.
  const actionsRef = useRef({ loadData, loadSchedule });
  actionsRef.current = { loadData, loadSchedule };

  useEffect(() => {
    loadData();
    loadSchedule(); // restaure l'état auto au chargement / après un F5

    // Bannière d'expiration du token LinkedIn — best-effort, silencieux si
    // LINKEDIN_TOKEN_ISSUED_AT n'est pas configuré côté serveur.
    fetch(`${API_BASE}/generate/linkedin-status`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && typeof json.daysRemaining === "number") {
          setLinkedinDaysRemaining(json.daysRemaining);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Réaligne le minuteur sur le serveur quand on revient sur l'onglet
  // (changement de page, onglet en arrière-plan, etc.)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        actionsRef.current.loadSchedule();
        actionsRef.current.loadData();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /* ---------- Minuteur d'affichage (la sync réelle est côté serveur) ---------- */

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Le serveur vient (ou est en train) de synchroniser :
          // on recharge les données et on réaligne le compte à rebours.
          actionsRef.current.loadData();
          actionsRef.current.loadSchedule();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  /* ---------- Données dérivées ---------- */

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedId) || null,
    [posts, selectedId]
  );
  const postA = useMemo(() => posts.find((p) => p.id === cmpA) || null, [posts, cmpA]);
  const postB = useMemo(() => posts.find((p) => p.id === cmpB) || null, [posts, cmpB]);

  const globalSeries = useMemo(
    () => bucketizeSeries(stats?.timeseries || [], granularity),
    [stats, granularity]
  );

  const postSeries = useMemo(
    () => bucketizeSeries(selectedPost?.history || [], "hour"),
    [selectedPost]
  );

  const compareBars = useMemo(() => {
    if (!postA || !postB) return [];
    return [
      { metric: "Réactions", A: postA.reactions || 0, B: postB.reactions || 0 },
      { metric: "Commentaires", A: postA.comments || 0, B: postB.comments || 0 },
      { metric: "Partages", A: postA.shares || 0, B: postB.shares || 0 },
      { metric: "Total", A: postA.total_interactions || 0, B: postB.total_interactions || 0 },
    ];
  }, [postA, postB]);

  const topBars = useMemo(
    () =>
      (stats?.topPosts || []).map((p, i) => ({
        name: `#${i + 1}`,
        title: p.title,
        interactions: p.total_interactions,
      })),
    [stats]
  );

  /* ============================ Rendu ============================ */

  const axis = { stroke: C.textSecondary, fontSize: 12 };
  const isHourView = granularity === "hour";

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: C.bgMain,
        color: C.textMain,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, padding: "28px clamp(16px, 4vw, 48px)" }}>
      <style>{`
        @keyframes dashmove { to { stroke-dashoffset: -16; } }
        @keyframes dayflash { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
        .day-divider { animation: dayflash 1.4s ease-in-out infinite; }
        .day-divider line { animation: dashmove 1s linear infinite; }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ---------------- Header ---------------- */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 26,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Logo size={46} showText={false} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>PostGenius AI</div>
              <div style={{ color: C.textSecondary, fontSize: 13 }}>Dashboard — Mes Postes</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Minuteur */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "8px 14px",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: autoRefresh ? C.green : C.textSecondary,
                  boxShadow: autoRefresh ? `0 0 10px ${C.green}` : "none",
                }}
              />
              <span style={{ color: C.textSecondary, fontSize: 12 }}>
                {autoRefresh ? "Prochaine MAJ (serveur)" : "Auto désactivé"}
              </span>
              <b
                style={{
                  fontVariantNumeric: "tabular-nums",
                  color: autoRefresh ? C.cyan : C.textSecondary,
                  fontSize: 15,
                }}
              >
                {autoRefresh ? mmss(secondsLeft) : "--:--"}
              </b>
            </div>

            <GhostButton active={autoRefresh} onClick={toggleAuto}>
              {autoRefresh ? "⏸ Stop auto" : "▶ Auto (5 min)"}
            </GhostButton>

            <PrimaryButton onClick={syncNow} disabled={syncing}>
              {syncing ? "⟳ Sync…" : "⟳ Mettre à jour"}
            </PrimaryButton>
          </div>
        </div>

        {/* ---------------- Bannière expiration token LinkedIn ---------------- */}
        {linkedinDaysRemaining !== null && linkedinDaysRemaining <= 14 && (
          <Card
            style={{
              marginBottom: 18,
              borderColor: linkedinDaysRemaining <= 0 ? C.red : C.amber,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: linkedinDaysRemaining <= 0 ? C.red : C.amber }}>
              {linkedinDaysRemaining <= 0
                ? "⚠ Le token de publication LinkedIn a probablement expiré."
                : `⚠ Le token de publication LinkedIn expire dans ${linkedinDaysRemaining} jour${linkedinDaysRemaining > 1 ? "s" : ""}.`}
            </span>
            <span style={{ color: C.textSecondary, fontSize: 13 }}>
              Régénère-le depuis le Token Generator LinkedIn (scopes w_member_social, openid, profile) et mets à jour LINKEDIN_ACCESS_TOKEN + LINKEDIN_TOKEN_ISSUED_AT dans .env.
            </span>
          </Card>
        )}

        {/* ---------------- Profil + messages ---------------- */}
        <Card style={{ marginBottom: 22, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: C.textSecondary, fontSize: 13 }}>Profil LinkedIn :</span>
          <input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            style={{
              flex: 1,
              minWidth: 260,
              background: C.bgSecondary,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.textMain,
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
            }}
          />
        </Card>

        {error && (
          <Card style={{ marginBottom: 18, borderColor: C.red }}>
            <span style={{ color: C.red }}>⚠ {error}</span>
          </Card>
        )}
        {notice && (
          <Card style={{ marginBottom: 18, borderColor: C.green }}>
            <span style={{ color: C.green }}>✓ {notice}</span>
          </Card>
        )}

        {/* ---------------- KPI ---------------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 22,
          }}
        >
          <KpiCard
            label="Postes suivis"
            value={fmtNum(stats?.kpis.totalPosts)}
            accent={C.blue}
          />
          <KpiCard
            label="Interactions totales"
            value={fmtNum(stats?.kpis.totalInteractions)}
            accent={C.cyan}
            sub={`${fmtNum(stats?.kpis.totalReactions)} réactions · ${fmtNum(
              stats?.kpis.totalComments
            )} comm.`}
          />
          <KpiCard
            label="Moyenne / poste"
            value={fmtNum(stats?.kpis.avgInteractions)}
            accent={C.mauve}
          />
          <KpiCard
            label="Meilleur poste"
            value={fmtNum(stats?.kpis.bestPost?.total_interactions)}
            accent={C.green}
            sub={stats?.kpis.bestPost?.title || "—"}
          />
        </div>

        {/* ---------------- Onglets ---------------- */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <GhostButton active={tab === "global"} onClick={() => setTab("global")}>
            📈 Vue globale
          </GhostButton>
          <GhostButton active={tab === "post"} onClick={() => setTab("post")}>
            🔍 Par poste
          </GhostButton>
          <GhostButton active={tab === "compare"} onClick={() => setTab("compare")}>
            ⚖ Comparer
          </GhostButton>
        </div>

        {loading ? (
          <Card>
            <span style={{ color: C.textSecondary }}>Chargement…</span>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <Eyebrow>Aucune donnée</Eyebrow>
            <p style={{ color: C.textSecondary, marginTop: 0 }}>
              Aucun poste enregistré. Cliquez sur <b style={{ color: C.textMain }}>Mettre à jour</b> pour
              lancer la première collecte LinkedIn.
            </p>
          </Card>
        ) : (
          <>
            {/* ================= VUE GLOBALE ================= */}
            {tab === "global" && (
              <div style={{ display: "grid", gap: 18 }}>
                <Card>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div>
                      <Eyebrow>Le fonctionnement</Eyebrow>
                      <h3 style={{ margin: "0 0 4px" }}>Évolution des interactions (global)</h3>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {GRANULARITIES.map((g) => {
                        const active = granularity === g.key;
                        return (
                          <button
                            key={g.key}
                            onClick={() => setGranularity(g.key)}
                            style={{
                              background: active ? C.bgSecondary : "transparent",
                              color: active ? C.cyan : C.textSecondary,
                              border: `1px solid ${active ? C.cyan : C.border}`,
                              borderRadius: 999,
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p style={{ color: C.textSecondary, marginTop: 0, fontSize: 13 }}>
                    Chaque point correspond à une synchronisation. La courbe se construit au fil des
                    mises à jour.
                  </p>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer>
                      <AreaChart data={globalSeries}>
                        <defs>
                          <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.cyan} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                        <XAxis
                          dataKey={isHourView ? "key" : "t"}
                          tick={axis}
                          tickFormatter={isHourView ? timeFormatter(globalSeries) : undefined}
                          minTickGap={isHourView ? 24 : 5}
                        />
                        <YAxis tick={axis} />
                        <Tooltip content={<ChartTooltip />} />
                        {isHourView && renderDayDividers(globalSeries)}
                        <Area
                          type="monotone"
                          dataKey="total"
                          name="Interactions"
                          stroke={C.cyan}
                          strokeWidth={2.5}
                          fill="url(#gTotal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: 18,
                  }}
                >
                  <Card>
                    <h3 style={{ margin: "0 0 12px" }}>Répartition dans le temps</h3>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer>
                        <LineChart data={globalSeries}>
                          <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                          <XAxis
                            dataKey={isHourView ? "key" : "t"}
                            tick={axis}
                            tickFormatter={isHourView ? timeFormatter(globalSeries) : undefined}
                            minTickGap={isHourView ? 24 : 5}
                          />
                          <YAxis tick={axis} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 12, color: C.textSecondary }} />
                          {isHourView && renderDayDividers(globalSeries)}
                          <Line type="monotone" dataKey="reactions" name="Réactions" stroke={C.blue} strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="comments" name="Commentaires" stroke={C.mauve} strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="shares" name="Partages" stroke={C.green} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <h3 style={{ margin: "0 0 12px" }}>Top 5 postes</h3>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={topBars} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                          <XAxis type="number" tick={axis} />
                          <YAxis type="category" dataKey="name" tick={axis} width={40} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="interactions" name="Interactions" fill={C.violet} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                {/* Liste des postes */}
                <Card>
                  <h3 style={{ margin: "0 0 14px" }}>Tous mes postes</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    {posts.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          background: C.bgSecondary,
                          border: `1px solid ${C.border}`,
                          borderRadius: 12,
                          padding: "12px 16px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: C.textMain,
                              fontSize: 14,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 520,
                            }}
                          >
                            {p.title || "Publication"}
                          </div>
                          <div style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }}>
                            {fmtDate(p.date_posted)} · {fmtNum(p.total_interactions)} interactions
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <GhostButton onClick={() => setDetailPost(p)}>Détail</GhostButton>
                          <GhostButton
                            onClick={() => {
                              setSelectedId(p.id);
                              setTab("post");
                            }}
                          >
                            Évolution
                          </GhostButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ================= PAR POSTE ================= */}
            {tab === "post" && (
              <div style={{ display: "grid", gap: 18 }}>
                <Card>
                  <label style={{ color: C.textSecondary, fontSize: 13, display: "block", marginBottom: 8 }}>
                    Choisir un poste
                  </label>
                  <Select value={selectedId} onChange={setSelectedId} posts={posts} />
                </Card>

                {selectedPost && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 14,
                      }}
                    >
                      <KpiCard label="Interactions" value={fmtNum(selectedPost.total_interactions)} accent={C.cyan} />
                      <KpiCard label="Réactions" value={fmtNum(selectedPost.reactions)} accent={C.blue} />
                      <KpiCard label="Commentaires" value={fmtNum(selectedPost.comments)} accent={C.mauve} />
                      <KpiCard label="Partages" value={fmtNum(selectedPost.shares)} accent={C.green} />
                    </div>

                    <Card>
                      <h3 style={{ margin: "0 0 4px" }}>Évolution de ce poste</h3>
                      <p style={{ color: C.textSecondary, marginTop: 0, fontSize: 13 }}>
                        {selectedPost.title}
                      </p>
                      <div style={{ height: 320 }}>
                        <ResponsiveContainer>
                          <LineChart data={postSeries}>
                            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="key"
                              tick={axis}
                              tickFormatter={timeFormatter(postSeries)}
                              minTickGap={24}
                            />
                            <YAxis tick={axis} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {renderDayDividers(postSeries)}
                            <Line type="monotone" dataKey="total" name="Total" stroke={C.cyan} strokeWidth={2.5} dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="reactions" name="Réactions" stroke={C.blue} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="comments" name="Commentaires" stroke={C.mauve} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="shares" name="Partages" stroke={C.green} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <GhostButton onClick={() => setDetailPost(selectedPost)}>Voir le détail complet</GhostButton>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* ================= COMPARER ================= */}
            {tab === "compare" && (
              <div style={{ display: "grid", gap: 18 }}>
                <Card>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ color: C.cyan, fontSize: 13, display: "block", marginBottom: 8 }}>
                        Poste A
                      </label>
                      <Select value={cmpA} onChange={setCmpA} posts={posts} />
                    </div>
                    <div>
                      <label style={{ color: C.mauve, fontSize: 13, display: "block", marginBottom: 8 }}>
                        Poste B
                      </label>
                      <Select value={cmpB} onChange={setCmpB} posts={posts} />
                    </div>
                  </div>
                </Card>

                {postA && postB && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                      gap: 18,
                    }}
                  >
                    <Card>
                      <h3 style={{ margin: "0 0 12px" }}>Comparatif par métrique</h3>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer>
                          <BarChart data={compareBars}>
                            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                            <XAxis dataKey="metric" tick={axis} />
                            <YAxis tick={axis} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="A" name="Poste A" fill={C.cyan} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="B" name="Poste B" fill={C.mauve} radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card>
                      <h3 style={{ margin: "0 0 12px" }}>Profil d'engagement</h3>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer>
                          <RadarChart data={compareBars.filter((c) => c.metric !== "Total")}>
                            <PolarGrid stroke={C.border} />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: C.textSecondary, fontSize: 12 }} />
                            <PolarRadiusAxis tick={{ fill: C.textSecondary, fontSize: 10 }} />
                            <Radar name="Poste A" dataKey="A" stroke={C.cyan} fill={C.cyan} fillOpacity={0.3} />
                            <Radar name="Poste B" dataKey="B" stroke={C.mauve} fill={C.mauve} fillOpacity={0.3} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Tooltip content={<ChartTooltip />} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                )}

                {postA && postB && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <CompareCol post={postA} color={C.cyan} label="Poste A" />
                    <CompareCol post={postB} color={C.mauve} label="Poste B" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* ---------------- Modale détail ---------------- */}
      {detailPost && <DetailModal post={detailPost} onClose={() => setDetailPost(null)} />}
    </div>
  );
}

/* ============================ Sous-composants ============================ */

function Select({
  value,
  onChange,
  posts,
}: {
  value: string;
  onChange: (v: string) => void;
  posts: Post[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        background: C.bgSecondary,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        color: C.textMain,
        padding: "11px 14px",
        fontSize: 14,
        outline: "none",
      }}
    >
      {posts.map((p) => (
        <option key={p.id} value={p.id} style={{ background: C.card }}>
          {(p.title || "Publication").slice(0, 70)} — {fmtNum(p.total_interactions)} int.
        </option>
      ))}
    </select>
  );
}

function CompareCol({ post, color, label }: { post: Post; color: string; label: string }) {
  const row = (k: string, v: number | undefined) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 14,
      }}
    >
      <span style={{ color: C.textSecondary }}>{k}</span>
      <b>{fmtNum(v)}</b>
    </div>
  );
  return (
    <Card style={{ borderColor: color }}>
      <div style={{ color, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.4 }}>{post.title}</div>
      {row("Total interactions", post.total_interactions)}
      {row("Réactions", post.reactions)}
      {row("Commentaires", post.comments)}
      {row("Partages", post.shares)}
      {row("Publié le", undefined)}
      <div style={{ marginTop: -34, textAlign: "right", fontSize: 14 }}>
        <b>{fmtDate(post.date_posted)}</b>
      </div>
    </Card>
  );
}

function DetailModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const series = bucketizeSeries(post.history || [], "hour");
  const axis = { stroke: C.textSecondary, fontSize: 12 };

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
          maxWidth: 640,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div>
            <Eyebrow>Détail du poste</Eyebrow>
            <h2 style={{ margin: "4px 0 0", fontSize: 18, lineHeight: 1.4 }}>
              {post.title || "Publication"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.textSecondary,
              borderRadius: 10,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            margin: "18px 0",
          }}
        >
          <MiniStat label="Total" value={post.total_interactions} color={C.cyan} />
          <MiniStat label="Réactions" value={post.reactions} color={C.blue} />
          <MiniStat label="Comm." value={post.comments} color={C.mauve} />
          <MiniStat label="Partages" value={post.shares} color={C.green} />
        </div>

        <div style={{ color: C.textSecondary, fontSize: 13, marginBottom: 16 }}>
          Publié le <b style={{ color: C.textMain }}>{fmtDate(post.date_posted)}</b>
          {post.url && (
            <>
              {" · "}
              <a href={post.url} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>
                Ouvrir sur LinkedIn ↗
              </a>
            </>
          )}
        </div>

        {series.length > 1 && (
          <div style={{ height: 200, marginBottom: 12 }}>
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.cyan} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                <XAxis dataKey="key" tick={axis} tickFormatter={timeFormatter(series)} minTickGap={24} />
                <YAxis tick={axis} />
                <Tooltip content={<ChartTooltip />} />
                {renderDayDividers(series)}
                <Area type="monotone" dataKey="total" name="Interactions" stroke={C.cyan} fill="url(#gDetail)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {(post.post_text || post.text) && (
          <div
            style={{
              background: C.bgSecondary,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 16,
              color: C.textSecondary,
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {post.post_text || post.text}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <div
      style={{
        background: C.bgSecondary,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 10px",
        textAlign: "center",
      }}
    >
      <div style={{ color, fontSize: 20, fontWeight: 800 }}>{fmtNum(value)}</div>
      <div style={{ color: C.textSecondary, fontSize: 11, marginTop: 4 }}>{label}</div>
    </div>
  );
}

/* ============================ Sidebar ============================ */

function Sidebar() {

  const router = useRouter();

  const go = (path: string) => {
    router.push(path);
  };

  const goMesPostes = () => go("/dashboard")

  const goPostesGeneres = () => go("/generated")

  const goPostesSupprimes = () => go("/generated/deleted")

  const goCaracteristiques = () => go("/keys")

  const goAccueil = () => go("/")

  const items = [
    {
      key: "mes-postes",
      label: "Mes postes",
      icon: "📊",
      active: true,
      onClick: goMesPostes,
      hint: "Suivi de vos publications",
    },
    {
      key: "postes-generes",
      label: "Postes générés",
      icon: "✨",
      active: false,
      onClick: goPostesGeneres,
      hint: "Postes générés par l'IA",
    },
    {
      key: "postes-supprimes",
      label: "Postes supprimés",
      icon: "🗑️",
      active: false,
      onClick: goPostesSupprimes,
      hint: "Postes générés supprimés",
    },
    {
      key: "caracteristiques",
      label: "Caractéristiques",
      icon: "🧬",
      active: false,
      onClick: goCaracteristiques,
      hint: "Dimensions d'analyse",
    },
    {
      key: "accueil",
      label: "Accueil",
      icon: "🏠",
      active: false,
      onClick: goAccueil,
      hint: "Retour à l'accueil",
    },
  ];

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: C.bgSecondary,
        borderRight: `1px solid ${C.border}`,
        padding: "24px 16px",
        position: "sticky",
        top: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ padding: "0 8px 22px" }}>
        <Logo size={38} textSize={16} />
      </div>

      {items.map((it) => (
        <button
          key={it.key}
          onClick={it.onClick}
          title={it.hint}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            textAlign: "left",
            background: it.active ? GRAD_BLUE_VIOLET : "transparent",
            color: it.active ? C.textMain : C.textSecondary,
            border: `1px solid ${it.active ? "transparent" : C.border}`,
            borderRadius: 12,
            padding: "11px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 16 }}>{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </aside>
  );
}