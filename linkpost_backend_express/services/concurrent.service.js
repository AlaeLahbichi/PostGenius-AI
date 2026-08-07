import { brightDataConfig } from "../config/brightdata.js";

import {
  addConcurrent,
  findAllConcurrents,
  deleteConcurrent as repoDeleteConcurrent,
  upsertManyConcurrentPosts,
  deletePostsByConcurrent,
  countPostsByConcurrent,
  findAllConcurrentPosts,
  getImportCriteria,
  saveImportCriteria,
} from "../repositories/concurrent.repository.js";

/* ================================================================== */
/*  Bright Data                                                        */
/* ================================================================== */

const SNAPSHOT_BASE = process.env.BRIGHT_DATA_SNAPSHOT_URL || "https://api.brightdata.com/datasets/v3";
const POLL_MAX_ATTEMPTS = Number(process.env.BRIGHT_DATA_POLL_ATTEMPTS || 15);
const POLL_DELAY_MS = Number(process.env.BRIGHT_DATA_POLL_DELAY_MS || 5000);
const DEFAULT_START_DATE = "1970-01-01T00:00:00.000Z";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeDate(dateValue, defaultValue) {
  if (dateValue === null || dateValue === undefined || dateValue === "") return defaultValue;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) throw new Error(`Date invalide : ${dateValue}`);
  return d.toISOString();
}

function resolveId(post) {
  const c =
    post.id ??
    post.post_id ??
    post.postId ??
    post.urn ??
    post.activity_urn ??
    post.activity_id ??
    post.share_id ??
    post.url ??
    post.post_url ??
    null;
  return c !== null && c !== undefined && c !== "" ? String(c) : null;
}

function extractMetrics(post) {
  const reactions = toNumber(
    post.reactions_count ?? post.reaction_count ?? post.likes_count ?? post.like_count ??
      post.num_likes ?? post.total_reactions ?? post.likes ?? 0
  );
  const comments = toNumber(
    post.comments_count ?? post.comment_count ?? post.num_comments ?? post.total_comments ?? post.comments ?? 0
  );
  const shares = toNumber(
    post.shares_count ?? post.share_count ?? post.reposts_count ?? post.repost_count ??
      post.num_shares ?? post.total_shares ?? post.shares ?? 0
  );
  return { reactions, comments, shares, total_interactions: reactions + comments + shares };
}

function buildTitle(post) {
  const raw = post.title || post.headline || post.post_text || post.text || post.description || "Publication sans titre";
  const clean = String(raw).replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120)}…` : clean;
}

/**
 * Normalise un post en conservant le texte et les médias (images, vidéos).
 */
function normalizePost(post) {
  const metrics = extractMetrics(post);
  return {
    ...post,
    id: resolveId(post),
    title: buildTitle(post),
    ...metrics,
  };
}

function extractPostsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.posts)) return data.posts;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

async function waitForSnapshot(snapshotId) {
  const headers = { Authorization: `Bearer ${brightDataConfig.apiKey}` };
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const progressRes = await fetch(`${SNAPSHOT_BASE}/progress/${snapshotId}`, { headers });
    const progress = await progressRes.json().catch(() => ({}));
    if (progress.status === "ready") {
      const dataRes = await fetch(`${SNAPSHOT_BASE}/snapshot/${snapshotId}?format=json`, { headers });
      const text = await dataRes.text();
      try {
        return extractPostsFromResponse(JSON.parse(text));
      } catch {
        throw new Error("Le snapshot Bright Data n'est pas un JSON valide.");
      }
    }
    if (progress.status === "failed") throw new Error(`Collecte Bright Data échouée (snapshot ${snapshotId}).`);
    await sleep(POLL_DELAY_MS);
  }
  return null;
}

async function fetchPostsFromBrightData(profileUrl, { startDate = null, endDate = null } = {}) {
  if (!brightDataConfig.apiKey) throw new Error("BRIGHT_DATA_API_KEY est absente.");
  if (!profileUrl || typeof profileUrl !== "string") throw new Error("profileUrl est obligatoire.");

  const normalizedStartDate = normalizeDate(startDate, DEFAULT_START_DATE);
  const normalizedEndDate = normalizeDate(endDate, new Date().toISOString());

  if (new Date(normalizedStartDate).getTime() > new Date(normalizedEndDate).getTime()) {
    throw new Error("La date de début doit être inférieure ou égale à la date de fin.");
  }

  const body = {
    input: [{ url: profileUrl, start_date: normalizedStartDate, end_date: normalizedEndDate, only_authored_posts: true }],
  };

  const response = await fetch(brightDataConfig.apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${brightDataConfig.apiKey}`, ...brightDataConfig.defaultHeaders },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Bright Data n'a pas retourné un JSON valide.");
  }
  if (!response.ok) throw new Error(`Bright Data : ${response.status}\n\n${JSON.stringify(data)}`);

  if (data.snapshot_id) {
    const p = await waitForSnapshot(data.snapshot_id);
    if (p === null) return { async: true, snapshot_id: data.snapshot_id, posts: [] };
    return { async: false, posts: p };
  }
  return { async: false, posts: extractPostsFromResponse(data) };
}

/* ================================================================== */
/*  Critères d'import                                                  */
/* ================================================================== */

function normNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getCriteria() {
  return getImportCriteria();
}

export async function updateCriteria(input = {}) {
  const criteria = {
    minInteractions: normNum(input.minInteractions),
    minComments: normNum(input.minComments),
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    count: normNum(input.count),
  };
  return saveImportCriteria(criteria);
}

/**
 * Applique les critères : vide => tout.
 */
function applyCriteria(list, criteria) {
  let out = list;

  if (criteria.minInteractions != null)
    out = out.filter((p) => (p.total_interactions || 0) >= criteria.minInteractions);

  if (criteria.minComments != null)
    out = out.filter((p) => (p.comments || 0) >= criteria.minComments);

  if (criteria.startDate) {
    const t = new Date(criteria.startDate).getTime();
    out = out.filter((p) => !p.date_posted || new Date(p.date_posted).getTime() >= t);
  }
  if (criteria.endDate) {
    const t = new Date(criteria.endDate).getTime();
    out = out.filter((p) => !p.date_posted || new Date(p.date_posted).getTime() <= t);
  }

  out = [...out].sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0));

  if (criteria.count != null) out = out.slice(0, criteria.count);

  return out;
}

/* ================================================================== */
/*  Concurrents                                                        */
/* ================================================================== */

export async function addConcurrentUrl(url, name = null) {
  if (!url || typeof url !== "string" || !url.includes("linkedin.com")) {
    throw new Error("URL LinkedIn invalide.");
  }
  return addConcurrent(url.trim(), name);
}

export async function listConcurrents() {
  const list = await findAllConcurrents();
  const out = [];
  for (const c of list) {
    out.push({
      url: c.url,
      name: c.name || null,
      post_count: await countPostsByConcurrent(c.url),
      created_at: c.created_at,
    });
  }
  return out;
}

/**
 * Supprime un concurrent ET ses posts.
 */
export async function removeConcurrent(url) {
  const deletedPosts = await deletePostsByConcurrent(url);
  const delC = await repoDeleteConcurrent(url);
  return {
    success: true,
    deletedConcurrent: delC.deletedCount,
    deletedPosts: deletedPosts.deletedCount,
  };
}

/**
 * Tous les posts importés (pour l'affichage).
 */
export async function listConcurrentPosts() {
  return findAllConcurrentPosts();
}

/* ================================================================== */
/*  Import (collecte + stockage)                                       */
/* ================================================================== */

async function importOneConcurrent(url, criteria) {
  const fetched = await fetchPostsFromBrightData(url, {
    startDate: criteria.startDate,
    endDate: criteria.endDate,
  });

  if (fetched.async) {
    return { url, async: true, snapshot_id: fetched.snapshot_id, imported: 0, updated: 0, selected: 0 };
  }

  const normalized = fetched.posts.map(normalizePost);
  const selected = applyCriteria(normalized, criteria);
  const mongo = await upsertManyConcurrentPosts(selected, url);

  return {
    url,
    async: false,
    fetched: normalized.length,
    selected: selected.length,
    imported: mongo.inserted,
    updated: mongo.updated,
  };
}

export async function importAllConcurrents() {
  const criteria = await getImportCriteria();
  const list = await findAllConcurrents();

  const results = [];
  let totalImported = 0;
  let totalUpdated = 0;

  for (const c of list) {
    try {
      const r = await importOneConcurrent(c.url, criteria);
      results.push(r);
      totalImported += r.imported || 0;
      totalUpdated += r.updated || 0;
    } catch (e) {
      results.push({ url: c.url, error: e.message });
    }
  }

  return { success: true, concurrents: list.length, totalImported, totalUpdated, results };
}

/* ================================================================== */
/*  Planificateur (import automatique côté serveur)                    */
/* ================================================================== */

let timer = null;
let running = false;
let intervalMs = 5 * 60 * 1000;
let nextRun = null;
let lastRun = null;
let lastError = null;
let lastSummary = null;

function secondsLeft() {
  return nextRun ? Math.max(0, Math.round((nextRun.getTime() - Date.now()) / 1000)) : null;
}

async function runOnce() {
  try {
    lastRun = new Date();
    lastSummary = await importAllConcurrents();
    lastError = null;
    console.log(`[concurrents] Import auto — ${lastSummary.totalImported} nouveaux, ${lastSummary.totalUpdated} mis à jour`);
  } catch (e) {
    lastError = e.message;
    console.error("[concurrents] Import auto échoué :", e.message);
  } finally {
    nextRun = new Date(Date.now() + intervalMs);
  }
}

export function startSchedule(minutes = 5) {
  stopSchedule();
  intervalMs = Math.max(1, Number(minutes) || 5) * 60 * 1000;
  running = true;
  nextRun = new Date(Date.now() + intervalMs);
  timer = setInterval(runOnce, intervalMs);
  console.log(`[concurrents] Import auto activé toutes les ${minutes} min`);
  return getScheduleStatus();
}

export function stopSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
  nextRun = null;
  return getScheduleStatus();
}

export function getScheduleStatus() {
  return {
    success: true,
    running,
    intervalMinutes: intervalMs / 60000,
    nextRun,
    lastRun,
    lastError,
    lastSummary,
    secondsLeft: secondsLeft(),
  };
}