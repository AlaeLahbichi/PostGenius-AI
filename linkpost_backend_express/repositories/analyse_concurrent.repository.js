import { getCollection } from "../config/mongodb.js";

const CONCURRENT_POSTS = "concurrent_postes";
const ANALYSES = "posts_analyses";

/* ================================================================== */
/*  Posts des concurrents (lecture seule)                              */
/* ================================================================== */

export async function findConcurrentPostById(id) {
  const col = getCollection(CONCURRENT_POSTS);
  return await col.findOne({ id });
}

export async function findAllConcurrentPosts() {
  const col = getCollection(CONCURRENT_POSTS);
  return await col.find().sort({ date_posted: -1 }).toArray();
}

/* ================================================================== */
/*  Analyses complètes (collection posts_analyses)                     */
/* ================================================================== */

async function analyses() {
  const col = getCollection(ANALYSES);
  await col.createIndex({ post_id: 1 }, { unique: true });
  return col;
}

export async function analysisExists(postId) {
  if (!postId) return false;
  const col = await analyses();
  return (await col.countDocuments({ post_id: postId })) > 0;
}

export async function findPostAnalysisByPostId(postId) {
  const col = await analyses();
  return await col.findOne({ post_id: postId });
}

export async function findAllPostAnalyses() {
  const col = await analyses();
  return await col.find().sort({ created_at: -1 }).toArray();
}

export async function upsertPostAnalysis(analysis) {
  if (!analysis?.post_id) throw new Error("post_id est obligatoire.");
  const col = await analyses();
  const res = await col.updateOne(
    { post_id: analysis.post_id },
    { $set: { ...analysis, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } },
    { upsert: true }
  );
  return { inserted: res.upsertedCount > 0, updated: res.matchedCount > 0 };
}

/* ================================================================== */
/*  Dimensions normalisées (dim_angles, dim_hooks, dim_tools, …)       */
/*                                                                     */
/*  Structure d'un document :                                          */
/*  { _id, slug, value, post_ids: [...], usage_count,                  */
/*    created_at, updated_at }                                         */
/* ================================================================== */

/**
 * Ajoute (idempotent) une valeur de caractéristique dans sa dimension.
 * - post_ids : liste des posts qui utilisent cette valeur (sans doublon) ;
 * - usage_count : recalculé = nombre de post_ids.
 */
export async function applyDimensionValue(collectionName, { value, slug }, postId) {
  const col = getCollection(collectionName);
  await col.createIndex({ slug: 1 }, { unique: true });

  const now = new Date();

  // 1) upsert : crée la valeur si absente, ajoute le post_id sans doublon.
  await col.updateOne(
    { slug },
    {
      $setOnInsert: { value, created_at: now },
      $addToSet: { post_ids: postId },
      $set: { updated_at: now },
    },
    { upsert: true }
  );

  // 2) recalcule usage_count = taille de post_ids.
  const doc = await col.findOne({ slug }, { projection: { post_ids: 1 } });
  const count = Array.isArray(doc?.post_ids) ? doc.post_ids.length : 0;
  await col.updateOne({ slug }, { $set: { usage_count: count } });
}

/**
 * Liste les valeurs d'une dimension (les plus utilisées d'abord).
 */
export async function listDimensionValues(collectionName, limit = 50) {
  const col = getCollection(collectionName);
  return await col.find().sort({ usage_count: -1 }).limit(limit).toArray();
}