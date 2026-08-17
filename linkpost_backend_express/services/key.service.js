import {
  DIMENSION_DEFS,
  listDimensionValues,
  countAnalyses,
  getAnalysesPerf,
  getPostDates,
} from "../repositories/key.repository.js";

/* ============================ Helpers ============================ */

export function avg(arr) {
  return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
}

export function canonical(v) {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Score d'impact d'une valeur de dimension : sa moyenne d'interactions
 * rapport\u00e9e \u00e0 la moyenne globale (1 = dans la moyenne, >1 = au-dessus).
 * 0 si aucune donn\u00e9e exploitable.
 */
export function computeImpactIndex(scores, globalAvg) {
  const a = scores.length ? Math.round(avg(scores)) : 0;
  const impact = globalAvg > 0 ? Number((a / globalAvg).toFixed(2)) : 0;
  return { avgInteractions: a, impactIndex: impact };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function bucketKey(dt, g) {
  const Y = dt.getFullYear();
  const M = pad(dt.getMonth() + 1);
  const D = pad(dt.getDate());
  const h = pad(dt.getHours());
  const m = pad(dt.getMinutes());
  switch (g) {
    case "year":
      return `${Y}`;
    case "month":
      return `${Y}-${M}`;
    case "day":
      return `${Y}-${M}-${D}`;
    case "hour":
      return `${Y}-${M}-${D} ${h}:00`;
    case "minute":
      return `${Y}-${M}-${D} ${h}:${m}`;
    default:
      return `${Y}-${M}-${D}`;
  }
}

function bucketTs(dt, g) {
  const d = new Date(dt);
  if (g === "year") {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  } else if (g === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  } else if (g === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (g === "hour") {
    d.setMinutes(0, 0, 0);
  } else if (g === "minute") {
    d.setSeconds(0, 0);
  }
  return d.getTime();
}

/* ============================ Évaluation globale ============================ */

export async function getOverview() {
  const perf = await getAnalysesPerf();
  const dates = await getPostDates();
  const totalAnalyses = await countAnalyses();

  // interaction d'un post : métrique d'analyse, sinon celle du post importé.
  const interactionOf = (id) => perf.get(id) ?? dates.get(id)?.interactions ?? 0;

  const allInteractions = [...perf.values()];
  const globalAvg = allInteractions.length ? Math.round(avg(allInteractions)) : 0;

  const dimensions = [];
  let distinctValues = 0;
  let bestImpactGlobal = null;

  for (const dim of DIMENSION_DEFS) {
    const values = await listDimensionValues(dim.collection);
    distinctValues += values.length;

    const items = values.map((v) => {
      const ids = (v.post_ids || []).map(String);
      const scores = ids.map(interactionOf);
      const { avgInteractions, impactIndex } = computeImpactIndex(scores, globalAvg);
      return {
        value: v.value,
        slug: v.slug,
        usage_count: v.usage_count ?? ids.length,
        avg_interactions: avgInteractions,
        impact_index: impactIndex,
      };
    });

    const totalUsage = items.reduce((s, i) => s + i.usage_count, 0) || 1;
    items.forEach((i) => {
      i.usage_share = Number(((i.usage_count / totalUsage) * 100).toFixed(1));
    });

    const sortedUsage = [...items].sort((a, b) => b.usage_count - a.usage_count);
    const top = sortedUsage[0] || null;
    const bestImpact =
      [...items].filter((i) => i.usage_count >= 2).sort((a, b) => b.impact_index - a.impact_index)[0] ||
      [...items].sort((a, b) => b.impact_index - a.impact_index)[0] ||
      null;

    if (bestImpact && (!bestImpactGlobal || bestImpact.impact_index > bestImpactGlobal.impact_index)) {
      bestImpactGlobal = { ...bestImpact, dimension: dim.key, dimensionLabel: dim.label };
    }

    dimensions.push({
      key: dim.key,
      label: dim.label,
      count: items.length,
      totalUsage,
      items: sortedUsage,
      top,
      bestImpact,
    });
  }

  const topDimension =
    [...dimensions].sort((a, b) => b.totalUsage - a.totalUsage)[0] || null;

  return {
    success: true,
    kpis: {
      totalAnalyses,
      globalAvgInteractions: globalAvg,
      distinctValues,
      topDimension: topDimension ? { key: topDimension.key, label: topDimension.label } : null,
      bestImpact: bestImpactGlobal,
    },
    dimensions,
  };
}

/* ============================ Évaluation d'une dimension ============================ */

export async function getDimensionDetail(dimKey) {
  const dim = DIMENSION_DEFS.find((d) => d.key === dimKey);
  if (!dim) throw new Error("Dimension inconnue.");

  const perf = await getAnalysesPerf();
  const dates = await getPostDates();
  const interactionOf = (id) => perf.get(id) ?? dates.get(id)?.interactions ?? 0;

  const allInteractions = [...perf.values()];
  const globalAvg = allInteractions.length ? Math.round(avg(allInteractions)) : 0;

  const values = await listDimensionValues(dim.collection);
  const items = values.map((v) => {
    const ids = (v.post_ids || []).map(String);
    const scores = ids.map(interactionOf);
    const { avgInteractions, impactIndex } = computeImpactIndex(scores, globalAvg);
    return {
      value: v.value,
      slug: v.slug,
      usage_count: v.usage_count ?? ids.length,
      avg_interactions: avgInteractions,
      impact_index: impactIndex,
    };
  });

  return { success: true, key: dim.key, label: dim.label, globalAvg, items };
}

/* ============================ Évaluation temporelle ============================ */

const GRANULARITIES = new Set(["year", "month", "day", "hour", "minute"]);

export async function getTimeline({ dimKey, value = null, granularity = "day" }) {
  const dim = DIMENSION_DEFS.find((d) => d.key === dimKey);
  if (!dim) throw new Error("Dimension inconnue.");
  const g = GRANULARITIES.has(granularity) ? granularity : "day";

  const values = await listDimensionValues(dim.collection);
  const perf = await getAnalysesPerf();
  const dates = await getPostDates();

  // Ensemble des posts à considérer.
  let ids = [];
  if (value && value !== "__all__") {
    const slug = canonical(value);
    const found = values.find((v) => v.slug === slug || v.value === value);
    ids = found ? (found.post_ids || []).map(String) : [];
  } else {
    const set = new Set();
    for (const v of values) for (const id of v.post_ids || []) set.add(String(id));
    ids = [...set];
  }

  const buckets = new Map();
  for (const id of ids) {
    const d = dates.get(id)?.date_posted;
    if (!d) continue;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) continue;

    const key = bucketKey(dt, g);
    const interactions = perf.get(id) ?? dates.get(id)?.interactions ?? 0;
    const b = buckets.get(key) || { count: 0, sum: 0, ts: bucketTs(dt, g) };
    b.count += 1;
    b.sum += interactions;
    buckets.set(key, b);
  }

  const series = [...buckets.entries()]
    .map(([label, b]) => ({
      label,
      bucket: b.ts,
      count: b.count,
      total_interactions: b.sum,
      avg_interactions: b.count ? Math.round(b.sum / b.count) : 0,
    }))
    .sort((a, b) => a.bucket - b.bucket);

  return {
    success: true,
    dim: dimKey,
    value: value || "__all__",
    granularity: g,
    totalPosts: ids.length,
    series,
  };
}