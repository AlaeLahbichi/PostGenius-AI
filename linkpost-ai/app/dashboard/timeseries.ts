/**
 * Logique pure de regroupement temporel des séries de métriques
 * (réactions/commentaires/partages dans le temps), extraite de
 * dashboard/page.tsx : aucune dépendance à React, à l'état du composant
 * ni au réseau — facilement isolable pour être testée ou réutilisée.
 */

export type Snapshot = {
  captured_at: string;
  reactions: number;
  comments: number;
  shares: number;
  total_interactions: number;
};

export type Granularity = "hour" | "day" | "week" | "month" | "year";

export const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "hour", label: "Détail" }, // heures + minutes (même jour)
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

export const fmtNum = (n: number | undefined) => (n ?? 0).toLocaleString("fr-FR");

export const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

export const mmss = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// Début de semaine (lundi) pour le regroupement hebdomadaire.
export const startOfWeek = (d: Date) => {
  const tmp = new Date(d);
  const dow = (tmp.getDay() + 6) % 7; // lundi = 0
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() - dow);
  return tmp;
};

// Clé de regroupement selon la granularité choisie.
export const bucketKey = (iso: string, g: Granularity) => {
  const d = new Date(iso);
  if (g === "hour") return iso; // chaque capture reste distincte (h:min)
  if (g === "day") return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (g === "week") {
    const w = startOfWeek(d);
    return `${w.getFullYear()}-${w.getMonth()}-${w.getDate()}`;
  }
  if (g === "month") return `${d.getFullYear()}-${d.getMonth()}`;
  return `${d.getFullYear()}`; // année
};

// Libellé affiché sur l'axe X selon la granularité.
export const bucketLabel = (iso: string, g: Granularity) => {
  const d = new Date(iso);
  if (g === "hour") return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (g === "day") return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  if (g === "week")
    return "sem. " + startOfWeek(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  if (g === "month") return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return String(d.getFullYear()); // année
};

/**
 * Type d'un point de série enrichi pour l'affichage.
 */
export type SeriesPoint = {
  key: string; // clé unique (indispensable pour placer les repères de jour)
  t: string; // libellé du bucket (heure, jour, mois…)
  time: string; // heure:minute (pour l'axe en mode détail)
  dt: number; // timestamp ms
  dayStart: boolean; // premier point d'un nouveau jour (affiche la date)
  dayChange: boolean; // changement de jour (trait vertical animé)
  dayLabel: string; // ex. "ven. 29/07"
  isHour: boolean; // vue détaillée (heure) ?
  total: number;
  reactions: number;
  comments: number;
  shares: number;
};

/**
 * Regroupe une série de snapshots selon la granularité.
 * Pour une métrique cumulative, on conserve la DERNIÈRE valeur
 * de chaque période (l'état atteint en fin de bucket).
 *
 * Ajoute les drapeaux de changement de jour pour matérialiser
 * le passage 20:30 -> 20:30 (lendemain) sur les graphes détaillés.
 */
export function bucketizeSeries(timeseries: Snapshot[], g: Granularity): SeriesPoint[] {
  const map = new Map<string, Snapshot & { _order: number }>();
  for (const s of timeseries) {
    const key = bucketKey(s.captured_at, g);
    // timeseries est trié par date croissante => la dernière écriture gagne
    map.set(key, { ...s, _order: new Date(s.captured_at).getTime() });
  }

  const sorted = Array.from(map.values()).sort((a, b) => a._order - b._order);

  let prevDay: string | null = null;

  return sorted.map((s, i) => {
    const d = new Date(s._order);
    const dayId = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const changed = i > 0 && dayId !== prevDay;
    const isFirst = i === 0;
    prevDay = dayId;

    return {
      key: String(s._order),
      t: bucketLabel(s.captured_at, g),
      time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      dt: s._order,
      dayStart: isFirst || changed,
      dayChange: changed,
      dayLabel: d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }),
      isHour: g === "hour",
      total: s.total_interactions,
      reactions: s.reactions,
      comments: s.comments,
      shares: s.shares,
    };
  });
}

// Formatteur d'axe X en mode détail : affiche l'heure au lieu de la clé.
export const timeFormatter = (data: SeriesPoint[]) => (k: string) =>
  data.find((p) => p.key === k)?.time ?? k;
