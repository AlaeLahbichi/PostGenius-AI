import { getCollection } from "../config/mongodb.js";

const CONCURRENT_POSTS = "concurrent_postes";
const CREATED = "post_created";

/**
 * Dimensions exploitées par l'assistant de génération.
 */
export const GEN_DIMS = {
  pattern: { collection: "dim_patterns", label: "Pattern", multi: false },
  hook: { collection: "dim_hooks", label: "Hook", multi: false },
  angle: { collection: "dim_angles", label: "Angle d'attaque", multi: false },
  style: { collection: "dim_styles", label: "Style", multi: true },
  tone: { collection: "dim_tones", label: "Ton", multi: true },
  format: { collection: "dim_formats", label: "Format", multi: true },
};

function canonical(v) {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Valeurs disponibles d'une dimension (les plus utilisées d'abord).
 */
export async function listValues(key) {
  const def = GEN_DIMS[key];
  if (!def) throw new Error("Dimension inconnue.");
  const col = getCollection(def.collection);
  const docs = await col.find().sort({ usage_count: -1 }).toArray();
  return docs.map((d) => ({
    value: d.value,
    slug: d.slug,
    usage_count: d.usage_count ?? (d.post_ids || []).length,
    post_count: (d.post_ids || []).length,
  }));
}

/**
 * Document d'une valeur (pour récupérer ses post_ids).
 */
export async function getValueDoc(key, value) {
  const def = GEN_DIMS[key];
  if (!def) return null;
  const col = getCollection(def.collection);
  const slug = canonical(value);
  return await col.findOne({ $or: [{ slug }, { value }] });
}

/**
 * Posts (contenu) à partir d'une liste d'ids.
 */
export async function getPostsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const col = getCollection(CONCURRENT_POSTS);
  const arr = ids.map(String);
  return await col.find({ id: { $in: arr } }).toArray();
}

/* ------------------------------------------------------------------ */
/*  Collection post_created                                            */
/* ------------------------------------------------------------------ */

export async function insertCreatedPost(doc) {
  const col = getCollection(CREATED);
  const now = new Date();
  const res = await col.insertOne({ ...doc, created_at: now, updated_at: now });
  return res.insertedId;
}

export async function listCreatedPosts() {
  const col = getCollection(CREATED);
  return await col.find().sort({ created_at: -1 }).toArray();
}