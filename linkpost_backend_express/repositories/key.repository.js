import { getCollection } from "../config/mongodb.js";

const CONCURRENT_POSTS = "concurrent_postes";
const OWN_POSTS = "mes_postes";
const ANALYSES = "posts_analyses";

/**
 * Les 10 dimensions et leur collection dédiée.
 */
export const DIMENSION_DEFS = [
  { key: "format", collection: "dim_formats", label: "Formats" },
  { key: "type", collection: "dim_types", label: "Types de post" },
  { key: "angle", collection: "dim_angles", label: "Angles d'attaque" },
  { key: "hook", collection: "dim_hooks", label: "Types de hook" },
  { key: "pattern", collection: "dim_patterns", label: "Patterns" },
  { key: "style", collection: "dim_styles", label: "Styles" },
  { key: "tone", collection: "dim_tones", label: "Tons" },
  { key: "tool", collection: "dim_tools", label: "Outils" },
  { key: "structure", collection: "dim_structures", label: "Structures" },
  { key: "keyword", collection: "dim_keywords", label: "Mots-clés" },
];

/**
 * Valeurs d'une dimension (les plus utilisées d'abord).
 */
export async function listDimensionValues(collectionName) {
  const col = getCollection(collectionName);
  return await col.find().sort({ usage_count: -1 }).toArray();
}

/**
 * Nombre total d'analyses.
 */
export async function countAnalyses() {
  return await getCollection(ANALYSES).countDocuments();
}

/**
 * Map post_id -> interactions (à partir des métriques des analyses).
 */
export async function getAnalysesPerf() {
  const map = new Map();
  const analyses = await getCollection(ANALYSES)
    .find({}, { projection: { post_id: 1, metrics: 1 } })
    .toArray();

  for (const a of analyses) {
    if (!a.post_id) continue;
    const m = a.metrics || {};
    const interactions =
      Number(m.total_interactions ?? (Number(m.num_likes || 0) + Number(m.num_comments || 0))) || 0;
    map.set(String(a.post_id), interactions);
  }
  return map;
}

/**
 * Map post_id -> { date_posted, interactions }, à partir des posts
 * concurrents importés ET de mes propres posts (mes_postes) — ces derniers
 * n'y contribuent que s'ils ont été reliés à un poste généré publié via
 * l'app (voir postReconciliation.service.js) et appliqués à une dimension.
 */
export async function getPostDates() {
  const map = new Map();
  const projection = { id: 1, date_posted: 1, total_interactions: 1, reactions: 1, comments: 1 };

  const [concurrentPosts, ownPosts] = await Promise.all([
    getCollection(CONCURRENT_POSTS).find({}, { projection }).toArray(),
    getCollection(OWN_POSTS).find({}, { projection }).toArray(),
  ]);

  for (const p of [...concurrentPosts, ...ownPosts]) {
    if (!p.id) continue;
    map.set(String(p.id), {
      date_posted: p.date_posted || null,
      interactions: Number(p.total_interactions ?? (Number(p.reactions || 0) + Number(p.comments || 0))) || 0,
    });
  }
  return map;
}

/**
 * Postes datés + interactions, séparément pour MES postes et pour les
 * posts concurrents — utilisé par le calcul du meilleur moment pour
 * publier (services/key.service.js), qui privilégie mes propres données
 * et ne retombe sur les concurrents qu'en dernier recours.
 */
export async function getDatedPosts() {
  const projection = { id: 1, date_posted: 1, total_interactions: 1, reactions: 1, comments: 1 };
  const shape = (p) => ({
    id: String(p.id),
    date_posted: p.date_posted || null,
    interactions: Number(p.total_interactions ?? (Number(p.reactions || 0) + Number(p.comments || 0))) || 0,
  });

  const [concurrentPosts, ownPosts] = await Promise.all([
    getCollection(CONCURRENT_POSTS).find({}, { projection }).toArray(),
    getCollection(OWN_POSTS).find({}, { projection }).toArray(),
  ]);

  return {
    own: ownPosts.filter((p) => p.id && p.date_posted).map(shape),
    competitors: concurrentPosts.filter((p) => p.id && p.date_posted).map(shape),
  };
}