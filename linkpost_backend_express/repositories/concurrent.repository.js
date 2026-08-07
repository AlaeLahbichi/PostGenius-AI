import { getCollection } from "../config/mongodb.js";

const CONCURRENTS = "concurrents";
const CONCURRENT_POSTS = "concurrent_postes";
const SETTINGS = "concurrent_settings";
const CRITERIA_ID = "import_criteria";

/* ------------------------------------------------------------------ */
/*  Collections                                                        */
/* ------------------------------------------------------------------ */

async function concurrents() {
  const col = getCollection(CONCURRENTS);
  await col.createIndex({ url: 1 }, { unique: true });
  return col;
}

async function posts() {
  const col = getCollection(CONCURRENT_POSTS);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ concurrent_url: 1 });
  return col;
}

async function settings() {
  return getCollection(SETTINGS);
}

/* ------------------------------------------------------------------ */
/*  Concurrents (profils)                                              */
/* ------------------------------------------------------------------ */

export async function addConcurrent(url, name = null) {
  const col = await concurrents();
  const res = await col.updateOne(
    { url },
    { $set: { url, name, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } },
    { upsert: true }
  );
  return { inserted: res.upsertedCount > 0, updated: res.matchedCount > 0 };
}

export async function findAllConcurrents() {
  const col = await concurrents();
  return await col.find().sort({ created_at: -1 }).toArray();
}

export async function findConcurrentByUrl(url) {
  const col = await concurrents();
  return await col.findOne({ url });
}

export async function deleteConcurrent(url) {
  const col = await concurrents();
  return await col.deleteOne({ url });
}

/* ------------------------------------------------------------------ */
/*  Posts des concurrents                                              */
/* ------------------------------------------------------------------ */

/**
 * Insère les nouveaux posts, met à jour ceux qui existent déjà.
 * Chaque post est marqué avec concurrent_url (clé étrangère).
 */
export async function upsertManyConcurrentPosts(list, concurrentUrl) {
  if (!Array.isArray(list) || list.length === 0) {
    return { total: 0, inserted: 0, updated: 0, errors: [] };
  }

  const col = await posts();
  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (const p of list) {
    if (!p.id) {
      errors.push({ id: null, message: "post sans id" });
      continue;
    }
    const { _id, created_at, updated_at, ...data } = p;
    const res = await col.updateOne(
      { id: p.id },
      {
        $set: { ...data, concurrent_url: concurrentUrl, updated_at: new Date() },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted++;
    else if (res.matchedCount > 0) updated++;
  }

  return { total: list.length, inserted, updated, errors };
}

export async function findPostsByConcurrent(url) {
  const col = await posts();
  return await col.find({ concurrent_url: url }).sort({ date_posted: -1 }).toArray();
}

export async function deletePostsByConcurrent(url) {
  const col = await posts();
  return await col.deleteMany({ concurrent_url: url });
}

export async function countPostsByConcurrent(url) {
  const col = await posts();
  return await col.countDocuments({ concurrent_url: url });
}

export async function findAllConcurrentPosts() {
  const col = await posts();
  return await col.find().sort({ date_posted: -1 }).toArray();
}

/* ------------------------------------------------------------------ */
/*  Critères d'import (persistés)                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_CRITERIA = {
  minInteractions: null,
  minComments: null,
  startDate: null,
  endDate: null,
  count: null,
};

export async function getImportCriteria() {
  const col = await settings();
  const doc = await col.findOne({ _id: CRITERIA_ID });
  return { ...DEFAULT_CRITERIA, ...(doc?.criteria || {}) };
}

export async function saveImportCriteria(criteria) {
  const col = await settings();
  await col.updateOne(
    { _id: CRITERIA_ID },
    { $set: { criteria, updated_at: new Date() } },
    { upsert: true }
  );
  return getImportCriteria();
}