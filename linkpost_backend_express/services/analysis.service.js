import {
  upsertPostAnalysis,
  findPostAnalysisByPostId,
  findAllPostAnalyses,
  deletePostAnalysis,
} from "../repositories/postAnalyse.repository.js";

import { applyValue, retractValue, listValues } from "../repositories/taxonomy.repository.js";

/**
 * Dimensions standardisées et leur collection MongoDB dédiée.
 *
 * - list = true  : le champ de l'analyse est un tableau (styles, tons…) ;
 * - list = false : le champ est une valeur unique (format, pattern…).
 */
const DIMENSIONS = [
  { key: "format", field: "format", list: false, collection: "dim_formats", label: "Formats" },
  { key: "type", field: "type_post", list: false, collection: "dim_types", label: "Types de post" },
  { key: "angle", field: "angle_attaque", list: false, collection: "dim_angles", label: "Angles d'attaque" },
  { key: "hook", field: "hook_type", list: false, collection: "dim_hooks", label: "Types de hook" },
  { key: "pattern", field: "pattern", list: false, collection: "dim_patterns", label: "Patterns" },
  { key: "style", field: "style", list: true, collection: "dim_styles", label: "Styles" },
  { key: "tone", field: "ton", list: true, collection: "dim_tones", label: "Tons" },
  { key: "tool", field: "outils", list: true, collection: "dim_tools", label: "Outils" },
  { key: "structure", field: "structure", list: true, collection: "dim_structures", label: "Structures" },
  { key: "keyword", field: "mots_cles", list: true, collection: "dim_keywords", label: "Mots-clés" },
];

/**
 * Clé canonique : minuscule, sans accents, sans ponctuation.
 * Permet de dédoublonner "Preuve par l'innovation" et "preuve par innovation".
 */
function canonical(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Extrait les valeurs propres et dédoublonnées d'une dimension.
 */
function valuesFor(analysis, dim) {
  const raw = analysis?.[dim.field];
  const arr = dim.list ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];

  const seen = new Set();
  const out = [];

  for (const v of arr) {
    const value = String(v ?? "").trim();
    if (!value) continue;
    const slug = canonical(value);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ value, slug });
  }

  return out;
}

/**
 * Enregistre une analyse ET met à jour les collections de dimensions.
 *
 * - Les explications (explication_*) restent personnalisées dans post_analyse ;
 * - Les valeurs standardisées sont stockées une seule fois par collection,
 *   avec usage_count et post_ids (clés étrangères) ;
 * - Ré-analyse du même post : compté une seule fois (dédoublonnage) ;
 * - Si une valeur a changé depuis la dernière analyse, l'ancienne est
 *   retirée proprement (les compteurs restent justes).
 */
export async function saveAnalysis(analysis) {
  const postId = analysis?.post_id;
  if (!postId) throw new Error("post_id est obligatoire.");

  const previous = await findPostAnalysisByPostId(postId);

  for (const dim of DIMENSIONS) {
    const nextVals = valuesFor(analysis, dim);
    const nextSlugs = new Set(nextVals.map((v) => v.slug));
    const prevVals = previous ? valuesFor(previous, dim) : [];

    // Retirer les valeurs que ce post n'utilise plus.
    for (const pv of prevVals) {
      if (!nextSlugs.has(pv.slug)) {
        await retractValue(dim.collection, pv.slug, postId);
      }
    }

    // Ajouter (idempotent) les valeurs courantes.
    for (const nv of nextVals) {
      await applyValue(dim.collection, nv, postId);
    }
  }

  // L'analyse complète (avec explications) reste dans post_analyse.
  const result = await upsertPostAnalysis(analysis);

  return {
    success: true,
    inserted: result.inserted,
    updated: result.updated,
    dimensionsUpdated: DIMENSIONS.map((d) => d.key),
  };
}

/**
 * Supprime une analyse ET retire ses contributions des dimensions.
 */
export async function removeAnalysis(postId) {
  const previous = await findPostAnalysisByPostId(postId);

  if (previous) {
    for (const dim of DIMENSIONS) {
      for (const pv of valuesFor(previous, dim)) {
        await retractValue(dim.collection, pv.slug, postId);
      }
    }
  }

  return await deletePostAnalysis(postId);
}

/**
 * Vocabulaire déjà utilisé, par dimension.
 *
 * Injecté dans le prompt du modèle pour qu'il RÉUTILISE les libellés
 * existants au lieu d'inventer des synonymes → standardisation croissante.
 */
export async function getVocabulary(limitPerDim = 40) {
  const vocabulary = {};

  for (const dim of DIMENSIONS) {
    const values = await listValues(dim.collection, limitPerDim);
    vocabulary[dim.key] = values.map((v) => v.value);
  }

  return { success: true, vocabulary };
}

/**
 * Insights : pour chaque dimension, les valeurs les plus fréquentes et
 * leur performance moyenne (interactions). Base pour générer de nouveaux
 * posts : on voit quelles "recettes" (hook, pattern, angle…) marchent.
 */
export async function getInsights(topPerDim = 12) {
  const analyses = await findAllPostAnalyses();

  // post_id -> interactions (métriques stockées avec l'analyse).
  const perf = new Map();
  for (const a of analyses) {
    const m = a.metrics || {};
    const interactions =
      Number(m.total_interactions ?? 0) ||
      Number(m.num_likes ?? 0) + Number(m.num_comments ?? 0);
    if (a.post_id) perf.set(a.post_id, interactions);
  }

  const dimensions = [];

  for (const dim of DIMENSIONS) {
    const values = await listValues(dim.collection, topPerDim);

    const items = values.map((v) => {
      const ids = v.post_ids || [];
      const scores = ids.map((id) => perf.get(id) ?? 0);
      const avg = scores.length
        ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
        : 0;

      return {
        value: v.value,
        usage_count: v.usage_count ?? ids.length,
        avg_interactions: avg,
        post_ids: ids,
      };
    });

    dimensions.push({ key: dim.key, label: dim.label, items });
  }

  return { success: true, totalAnalyses: analyses.length, dimensions };
}