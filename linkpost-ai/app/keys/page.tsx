"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  ComposedChart,
  Line,
  Legend,
} from "recharts";

/* ============================ Config ============================ */

const API_KEYS = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000") + "/keys";

/* ============================ Charte ============================ */

const C = {
  bgMain: "#050814",
  bgSecondary: "#0b1020",
  card: "#111827",
  border: "#1f2937",
  textMain: "#f8fafc",
  textSecondary: "#94a3b8",
  blue: "#2563eb",
  cyan: "#38bdf8",
  violet: "#7c3aed",
  mauve: "#a855f7",
  green: "#22c55e",
  amber: "#fbbf24",
  red: "#fca5a5",
};
const GRAD = "linear-gradient(135deg, #2563eb, #7c3aed)";

/* ============================ Types ============================ */

type Item = {
  value: string;
  slug: string;
  usage_count: number;
  usage_share?: number;
  avg_interactions: number;
  impact_index: number;
};
type Dimension = { key: string; label: string; count: number; totalUsage: number; items: Item[]; top: Item | null; bestImpact: Item | null };
type Overview = {
  success: boolean;
  kpis: {
    totalAnalyses: number;
    globalAvgInteractions: number;
    distinctValues: number;
    topDimension: { key: string; label: string } | null;
    bestImpact: (Item & { dimensionLabel?: string }) | null;
  };
  dimensions: Dimension[];
};
type SeriePoint = { label: string; bucket: number; count: number; total_interactions: number; avg_interactions: number };

const GRANS: { key: string; label: string }[] = [
  { key: "year", label: "Année" },
  { key: "month", label: "Mois" },
  { key: "day", label: "Jour" },
  { key: "hour", label: "Heure" },
  { key: "minute", label: "Minute" },
];

/* ============================ Helpers ============================ */

function impactColor(v: number) {
  if (v >= 1.15) return C.green;
  if (v >= 0.85) return C.amber;
  return C.red;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, ...style }}>{children}</div>;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#0b1225", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 12.5, color: C.textMain, boxShadow: "0 10px 30px -12px rgba(0,0,0,.8)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: C.textSecondary }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: C.textSecondary }}>{p.name} :</span>
          <b>{typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ============================ KPI ============================ */

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <Card style={{ padding: 18, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: accent }} />
      <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 8 }}>{sub}</div>}
    </Card>
  );
}

/* ============================ Page ============================ */

export default function KeysPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dimKey, setDimKey] = useState<string>("hook");
  const [granularity, setGranularity] = useState<string>("day");
  const [selValue, setSelValue] = useState<string>("__all__");
  const [series, setSeries] = useState<SeriePoint[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch(`${API_KEYS}/overview`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Chargement impossible.");
      setOverview(json);
      if (json.dimensions?.length && !json.dimensions.find((d: Dimension) => d.key === "hook")) {
        setDimKey(json.dimensions[0].key);
      }
    } catch (e: any) {
      setError(e?.message || `Backend injoignable (${API_KEYS}).`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadTimeline = useCallback(async () => {
    setLoadingSeries(true);
    try {
      const params = new URLSearchParams({ dim: dimKey, granularity });
      if (selValue !== "__all__") params.set("value", selValue);
      const res = await fetch(`${API_KEYS}/timeline?${params.toString()}`);
      const json = await res.json();
      setSeries(json.series || []);
    } catch {
      setSeries([]);
    } finally {
      setLoadingSeries(false);
    }
  }, [dimKey, granularity, selValue]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Réinitialise la valeur sélectionnée quand on change de dimension.
  useEffect(() => {
    setSelValue("__all__");
  }, [dimKey]);

  const currentDim = useMemo(
    () => overview?.dimensions.find((d) => d.key === dimKey) || null,
    [overview, dimKey]
  );

  const barData = useMemo(() => (currentDim?.items || []).slice(0, 12), [currentDim]);
  const scatterData = useMemo(
    () => (currentDim?.items || []).map((i) => ({ x: i.usage_count, y: i.impact_index, z: i.avg_interactions, value: i.value })),
    [currentDim]
  );

  /* ---------- États ---------- */

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "120px 0", color: C.textSecondary }}>
          <div className="spin" style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.cyan }} />
          <span>Chargement de l'évaluation…</span>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <Card style={{ borderColor: C.red, maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <div style={{ color: C.red, fontWeight: 700, marginBottom: 6 }}>Erreur</div>
          <div style={{ color: C.textSecondary, fontSize: 14 }}>{error}</div>
        </Card>
      </Shell>
    );
  }

  const k = overview!.kpis;
  const empty = k.totalAnalyses === 0;

  return (
    <Shell>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: GRAD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>✦</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Évaluation des dimensions</h1>
          <div style={{ color: C.textSecondary, fontSize: 13 }}>Usage, interactions et impact des critères analysés</div>
        </div>
      </div>

      {empty ? (
        <Card><span style={{ color: C.textSecondary }}>Aucune analyse pour l'instant. Analyse des posts pour alimenter les dimensions.</span></Card>
      ) : (
        <>
          {/* KPI */}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 22 }}>
            <Kpi label="Analyses réalisées" value={k.totalAnalyses.toLocaleString("fr-FR")} accent={C.blue} />
            <Kpi label="Interaction moyenne" value={k.globalAvgInteractions.toLocaleString("fr-FR")} sub="par post analysé" accent={C.cyan} />
            <Kpi label="Caractéristiques distinctes" value={k.distinctValues.toLocaleString("fr-FR")} sub={k.topDimension ? `Dimension la + riche : ${k.topDimension.label}` : undefined} accent={C.mauve} />
            <Kpi
              label="Meilleur impact"
              value={k.bestImpact ? `×${k.bestImpact.impact_index}` : "—"}
              sub={k.bestImpact ? `${k.bestImpact.value} · ${k.bestImpact.dimensionLabel}` : undefined}
              accent={C.green}
            />
          </div>

          {/* Sélecteur de dimension */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {overview!.dimensions.map((d) => {
              const active = d.key === dimKey;
              return (
                <button
                  key={d.key}
                  onClick={() => setDimKey(d.key)}
                  style={{
                    background: active ? GRAD : C.card,
                    color: active ? "#fff" : C.textSecondary,
                    border: `1px solid ${active ? "transparent" : C.border}`,
                    borderRadius: 999,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {d.label} <span style={{ opacity: 0.7 }}>· {d.count}</span>
                </button>
              );
            })}
          </div>

          {/* Graphes usage + impact */}
          <div className="charts-2col" style={{ display: "grid", gap: 18, marginBottom: 18 }}>
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Taux d'utilisation</div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 14 }}>Nombre de posts par valeur (couleur = impact)</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="value" tick={{ fill: C.textSecondary, fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fill: C.textSecondary, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,.08)" }} />
                  <Bar dataKey="usage_count" name="Utilisations" radius={[6, 6, 0, 0]}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={impactColor(d.impact_index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Carte de décision</div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 14 }}>X = usage · Y = impact · taille = interactions moy.</div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 4, right: 12, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis type="number" dataKey="x" name="Usage" tick={{ fill: C.textSecondary, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="number" dataKey="y" name="Impact" tick={{ fill: C.textSecondary, fontSize: 11 }} />
                  <ZAxis type="number" dataKey="z" range={[60, 500]} name="Interactions" />
                  <ReferenceLine y={1} stroke={C.textSecondary} strokeDasharray="4 4" label={{ value: "moyenne", fill: C.textSecondary, fontSize: 10, position: "insideTopRight" }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={scatterData} name="Valeurs">
                    {scatterData.map((d, i) => (
                      <Cell key={i} fill={impactColor(d.y)} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Analyse temporelle */}
          <Card style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Évolution dans le temps</div>
                <div style={{ fontSize: 12, color: C.textSecondary }}>Utilisations (barres) et interaction moyenne (courbe)</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={selValue}
                  onChange={(e) => setSelValue(e.target.value)}
                  style={{ background: C.bgSecondary, color: C.textMain, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none", maxWidth: 220 }}
                >
                  <option value="__all__">Toutes les valeurs</option>
                  {(currentDim?.items || []).map((it) => (
                    <option key={it.slug} value={it.value}>{it.value}</option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 4, background: C.bgSecondary, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4 }}>
                  {GRANS.map((g) => {
                    const active = g.key === granularity;
                    return (
                      <button
                        key={g.key}
                        onClick={() => setGranularity(g.key)}
                        style={{ background: active ? C.blue : "transparent", color: active ? "#fff" : C.textSecondary, border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {loadingSeries ? (
              <div style={{ color: C.textSecondary, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Chargement…</div>
            ) : series.length === 0 ? (
              <div style={{ color: C.textSecondary, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Aucune donnée datée pour ce critère.</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: C.textSecondary, fontSize: 11 }} interval="preserveStartEnd" angle={-20} textAnchor="end" height={64} />
                  <YAxis yAxisId="left" tick={{ fill: C.textSecondary, fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: C.textSecondary, fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,.08)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.textSecondary }} />
                  <Bar yAxisId="left" dataKey="count" name="Utilisations" fill={C.blue} radius={[6, 6, 0, 0]} maxBarSize={38} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_interactions" name="Interaction moy." stroke={C.cyan} strokeWidth={2.5} dot={{ r: 3, fill: C.cyan }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Tableau de classement */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Classement — {currentDim?.label}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ color: C.textSecondary, textAlign: "left", fontSize: 12 }}>
                    <th style={th}>Valeur</th>
                    <th style={{ ...th, textAlign: "right" }}>Usage</th>
                    <th style={{ ...th, textAlign: "right" }}>Part</th>
                    <th style={{ ...th, textAlign: "right" }}>Interaction moy.</th>
                    <th style={{ ...th, textAlign: "right" }}>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {(currentDim?.items || []).map((it) => (
                    <tr key={it.slug} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ ...td, fontWeight: 600 }}>{it.value}</td>
                      <td style={{ ...td, textAlign: "right" }}>{it.usage_count}</td>
                      <td style={{ ...td, textAlign: "right", color: C.textSecondary }}>{it.usage_share ?? 0}%</td>
                      <td style={{ ...td, textAlign: "right" }}>{it.avg_interactions.toLocaleString("fr-FR")}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: impactColor(it.impact_index), background: `${impactColor(it.impact_index)}18`, borderRadius: 999, padding: "3px 10px" }}>
                          ×{it.impact_index}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 12, lineHeight: 1.5 }}>
              Impact = interaction moyenne de la valeur ÷ interaction moyenne globale. ×1 = dans la moyenne ; ×1,5 = 50 % au-dessus. C'est une corrélation, pas une preuve de causalité.
            </div>
          </Card>
        </>
      )}
    </Shell>
  );
}

/* ============================ Shell ============================ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bgMain, color: C.textMain, fontFamily: "Inter, system-ui, sans-serif", padding: "28px clamp(16px, 4vw, 48px)" }}>
      <style>{`
        .spin { animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .charts-2col { grid-template-columns: 1fr; }
        @media (min-width: 940px) { .charts-2col { grid-template-columns: 1fr 1fr; } }
        table td, table th { white-space: nowrap; }
      `}</style>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 10px", color: "#e2e8f0" };