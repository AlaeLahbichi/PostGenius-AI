import { brightDataConfig } from "../config/brightdata.js";

import {
  upsertManyOwnPosts,
  findAllOwnPosts,
  findOwnPostById,
  aggregateGlobalHistory,
} from "../repositories/ownpost.repository.js";
import { reconcilePublishedPosts } from "./postReconciliation.service.js";

/**
 * Base de l'API snapshot Bright Data (Dataset API v3).
 * Configurable via .env, valeur par défaut standard.
 */
const SNAPSHOT_BASE =
  process.env.BRIGHT_DATA_SNAPSHOT_URL || "https://api.brightdata.com/datasets/v3";

/**
 * Paramètres du polling quand Bright Data répond
 * de façon asynchrone (snapshot_id).
 */
const POLL_MAX_ATTEMPTS = Number(process.env.BRIGHT_DATA_POLL_ATTEMPTS || 15);
const POLL_DELAY_MS = Number(process.env.BRIGHT_DATA_POLL_DELAY_MS || 5000);

const DEFAULT_START_DATE = "1970-01-01T00:00:00.000Z";

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function normalizeDate(dateValue, defaultValue) {
  if (dateValue === null || dateValue === undefined || dateValue === "") {
    return defaultValue;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date invalide : ${dateValue}`);
  }
  return date.toISOString();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrait les métriques d'un poste en gérant les
 * différents noms de champs renvoyés par Bright Data.
 */
export function extractMetrics(post) {
  const reactions = toNumber(
    post.reactions_count ??
      post.reaction_count ??
      post.likes_count ??
      post.like_count ??
      post.num_likes ??
      post.total_reactions ??
      post.likes ??
      0
  );

  const comments = toNumber(
    post.comments_count ??
      post.comment_count ??
      post.num_comments ??
      post.total_comments ??
      post.comments ??
      0
  );

  const shares = toNumber(
    post.shares_count ??
      post.share_count ??
      post.reposts_count ??
      post.repost_count ??
      post.num_shares ??
      post.total_shares ??
      post.shares ??
      0
  );

  return {
    reactions,
    comments,
    shares,
    total_interactions: reactions + comments + shares,
  };
}

/**
 * Construit un titre lisible pour l'affichage dashboard.
 */
export function buildTitle(post) {
  const raw =
    post.title ||
    post.headline ||
    post.post_text ||
    post.text ||
    post.description ||
    "Publication sans titre";
  const clean = String(raw).replace(/\s+/g, " ").trim();
  return clean.length > 90 ? `${clean.slice(0, 90)}…` : clean;
}

/**
 * Résout l'identifiant unique d'un poste.
 *
 * Bright Data ne renvoie pas toujours un champ `id`
 * au premier niveau : on teste les variantes courantes,
 * puis on retombe sur l'URL (toujours unique) en dernier.
 */
export function resolveId(post) {
  const candidate =
    post.id ??
    post.post_id ??
    post.postId ??
    post.urn ??
    post.activity_urn ??
    post.activity_id ??
    post.share_id ??
    post.shareId ??
    post.url ??
    post.post_url ??
    null;

  return candidate !== null && candidate !== undefined && candidate !== ""
    ? String(candidate)
    : null;
}

/**
 * Normalise un poste brut Bright Data en un document
 * exploitable par MongoDB et le dashboard.
 */
export function normalizeOwnPost(post) {
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

/* ------------------------------------------------------------------ */
/* Bright Data                                                         */
/* ------------------------------------------------------------------ */

/**
 * Attend qu'un snapshot asynchrone soit prêt puis
 * télécharge les données. Retourne un tableau de postes.
 */
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

    if (progress.status === "failed") {
      throw new Error(`Collecte Bright Data échouée (snapshot ${snapshotId}).`);
    }

    await sleep(POLL_DELAY_MS);
  }

  // Toujours en cours après le nombre max de tentatives.
  return null;
}

/**
 * Déclenche la collecte Bright Data pour un profil et
 * renvoie directement les postes (résout l'asynchrone).
 */
async function fetchOwnPostsFromBrightData(profileUrl, { startDate = null, endDate = null } = {}) {
  if (!brightDataConfig.apiKey) {
    throw new Error("BRIGHT_DATA_API_KEY est absente.");
  }
  if (!profileUrl || typeof profileUrl !== "string") {
    throw new Error("profileUrl est obligatoire.");
  }

  const normalizedStartDate = normalizeDate(startDate, DEFAULT_START_DATE);
  const normalizedEndDate = normalizeDate(endDate, new Date().toISOString());

  if (new Date(normalizedStartDate).getTime() > new Date(normalizedEndDate).getTime()) {
    throw new Error("La date de début doit être inférieure ou égale à la date de fin.");
  }

  const body = {
    input: [
      {
        url: profileUrl,
        start_date: normalizedStartDate,
        end_date: normalizedEndDate,
        only_authored_posts: true,
      },
    ],
  };

  const response = await fetch(brightDataConfig.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${brightDataConfig.apiKey}`,
      ...brightDataConfig.defaultHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Bright Data n'a pas retourné un JSON valide.");
  }

  if (!response.ok) {
    throw new Error(`Bright Data : ${response.status}\n\n${JSON.stringify(data)}`);
  }

  // Réponse asynchrone : on attend le snapshot.
  if (data.snapshot_id) {
    const posts = await waitForSnapshot(data.snapshot_id);
    if (posts === null) {
      return {
        async: true,
        snapshot_id: data.snapshot_id,
        posts: [],
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      };
    }
    return {
      async: false,
      posts,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    };
  }

  return {
    async: false,
    posts: extractPostsFromResponse(data),
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  };
}

/* ------------------------------------------------------------------ */
/* Services exposés                                                    */
/* ------------------------------------------------------------------ */

/**
 * Synchronise MES postes LinkedIn.
 * Bright Data -> normalisation -> MongoDB (avec historique).
 */
export async function syncOwnPosts(profileUrl, { startDate = null, endDate = null } = {}) {
  const result = await fetchOwnPostsFromBrightData(profileUrl, { startDate, endDate });

  if (result.async) {
    return {
      success: true,
      async: true,
      snapshot_id: result.snapshot_id,
      message: "La collecte est toujours en cours. Relancez la synchronisation dans quelques instants.",
    };
  }

  const normalized = result.posts.map(normalizeOwnPost);

  // Un même instant de capture pour tout le lot :
  // indispensable pour l'évolution globale.
  const capturedAt = new Date();
  const mongoResult = await upsertManyOwnPosts(normalized, capturedAt);

  // Ferme la boucle : relie les postes générés fraîchement publiés à leur
  // version réelle, et fait remonter leurs vraies performances dans le
  // scoring des dimensions. Best-effort — ne doit jamais faire échouer
  // la synchronisation elle-même.
  let reconciled = 0;
  try {
    const reconciliation = await reconcilePublishedPosts(normalized);
    reconciled = reconciliation.linked;
  } catch (error) {
    console.error("[reconciliation] échec :", error.message);
  }

  return {
    success: true,
    async: false,
    profile: profileUrl,
    captured_at: capturedAt,
    totalFetched: normalized.length,
    inserted: mongoResult.inserted,
    updated: mongoResult.updated,
    // Diagnostic : postes rejetés (ex. id introuvable)
    skipped: mongoResult.errors.length,
    errors: mongoResult.errors,
    reconciled,
    posts: normalized,
  };
}

/**
 * Statistiques globales + évolution dans le temps.
 */
export async function getOwnPostsGlobalStats() {
  const posts = await findAllOwnPosts();

  const totals = posts.reduce(
    (acc, p) => {
      acc.interactions += p.total_interactions || 0;
      acc.reactions += p.reactions || 0;
      acc.comments += p.comments || 0;
      acc.shares += p.shares || 0;
      return acc;
    },
    { interactions: 0, reactions: 0, comments: 0, shares: 0 }
  );

  const totalPosts = posts.length;
  const avgInteractions = totalPosts ? Math.round(totals.interactions / totalPosts) : 0;

  const topPosts = [...posts]
    .sort((a, b) => (b.total_interactions || 0) - (a.total_interactions || 0))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      title: p.title || "Publication",
      url: p.url || null,
      total_interactions: p.total_interactions || 0,
      reactions: p.reactions || 0,
      comments: p.comments || 0,
      shares: p.shares || 0,
    }));

  const timeseries = await aggregateGlobalHistory();

  return {
    success: true,
    kpis: {
      totalPosts,
      totalInteractions: totals.interactions,
      totalReactions: totals.reactions,
      totalComments: totals.comments,
      totalShares: totals.shares,
      avgInteractions,
      bestPost: topPosts[0] || null,
    },
    topPosts,
    timeseries,
  };
}

/**
 * Retourne l'évolution (historique) d'un poste précis.
 */
export async function getOwnPostEvolution(id) {
  const post = await findOwnPostById(id);
  if (!post) return null;

  return {
    success: true,
    id: post.id,
    title: post.title || "Publication",
    url: post.url || null,
    current: {
      reactions: post.reactions || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
      total_interactions: post.total_interactions || 0,
    },
    history: post.history || [],
  };
}

/**
 * Compare deux postes (métriques actuelles + historiques).
 */
export async function compareOwnPosts(idA, idB) {
  if (!idA || !idB) {
    throw new Error("Les deux identifiants de postes sont obligatoires.");
  }

  const [postA, postB] = await Promise.all([findOwnPostById(idA), findOwnPostById(idB)]);

  if (!postA || !postB) {
    throw new Error("Un des deux postes est introuvable.");
  }

  const shape = (p) => ({
    id: p.id,
    title: p.title || "Publication",
    url: p.url || null,
    date_posted: p.date_posted || null,
    reactions: p.reactions || 0,
    comments: p.comments || 0,
    shares: p.shares || 0,
    total_interactions: p.total_interactions || 0,
    history: p.history || [],
  });

  return {
    success: true,
    postA: shape(postA),
    postB: shape(postB),
  };
}