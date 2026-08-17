import { getCollection } from "../config/mongodb.js";

/**
 * Collection dédiée à MES propres publications.
 */
const COLLECTION_NAME = "mes_postes";

/**
 * Nombre maximum de snapshots conservés par poste.
 * Évite que l'historique grossisse indéfiniment.
 */
const MAX_HISTORY = 1000;

/**
 * Retourne la collection mes_postes et garantit
 * l'index unique sur l'identifiant LinkedIn.
 */
async function collection() {
  const ownPosts = getCollection(COLLECTION_NAME);
  await ownPosts.createIndex({ id: 1 }, { unique: true });
  return ownPosts;
}

/**
 * Vérifie qu'un poste possède un id exploitable.
 */
function validateOwnPostId(post) {
  if (!post || post.id === null || post.id === undefined || post.id === "") {
    throw new Error("Impossible d'enregistrer un poste sans id.");
  }
}

/**
 * Construit un snapshot des métriques d'un poste
 * à un instant T (utilisé pour tracer l'évolution).
 */
function buildSnapshot(post, capturedAt) {
  return {
    captured_at: capturedAt,
    reactions: Number(post.reactions ?? 0),
    comments: Number(post.comments ?? 0),
    shares: Number(post.shares ?? 0),
    total_interactions: Number(post.total_interactions ?? 0),
  };
}

/**
 * Insère ou met à jour plusieurs postes ET pousse
 * un point d'historique pour chacun.
 *
 * - capturedAt est identique pour tout le lot afin de
 *   pouvoir agréger l'évolution globale par synchronisation.
 * - si l'id existe : mise à jour + nouveau snapshot ;
 * - sinon : insertion + premier snapshot.
 */
export async function upsertManyOwnPosts(postsList, capturedAt = new Date()) {
  if (!Array.isArray(postsList)) {
    throw new Error("postsList doit être un tableau.");
  }

  if (postsList.length === 0) {
    return { total: 0, inserted: 0, updated: 0, modified: 0, unchanged: 0, errors: [] };
  }

  const ownPosts = await collection();

  let inserted = 0;
  let updated = 0;
  let modified = 0;
  let unchanged = 0;
  const errors = [];

  for (const post of postsList) {
    try {
      validateOwnPostId(post);

      const snapshot = buildSnapshot(post, capturedAt);

      // On retire les champs qui ne doivent pas écraser
      // l'historique ou les dates de création.
      const { history, created_at, updated_at, _id, ...postData } = post;

      const result = await ownPosts.updateOne(
        { id: post.id },
        {
          $set: { ...postData, updated_at: new Date() },
          $setOnInsert: { created_at: new Date() },
          $push: {
            history: { $each: [snapshot], $slice: -MAX_HISTORY },
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        inserted++;
        continue;
      }

      if (result.matchedCount > 0) {
        updated++;
        if (result.modifiedCount > 0) modified++;
        else unchanged++;
      }
    } catch (error) {
      errors.push({ ownPostId: post?.id ?? null, message: error.message });
    }
  }

  return {
    total: postsList.length,
    inserted,
    updated,
    modified,
    unchanged,
    errors,
  };
}

/**
 * Retourne tous mes postes (les plus récents d'abord).
 */
export async function findAllOwnPosts() {
  const ownPosts = await collection();
  return await ownPosts.find().sort({ date_posted: -1 }).toArray();
}

/**
 * Retourne un poste par son id LinkedIn.
 */
export async function findOwnPostById(id) {
  const ownPosts = await collection();
  return await ownPosts.findOne({ id });
}

/**
 * Retourne un poste par son URL.
 */
export async function findOwnPostByUrl(url) {
  const ownPosts = await collection();
  return await ownPosts.findOne({ url });
}

/**
 * Agrège l'historique de TOUS les postes pour obtenir
 * l'évolution globale, regroupée par instant de capture.
 */
export async function aggregateGlobalHistory() {
  const ownPosts = await collection();

  return await ownPosts
    .aggregate([
      { $unwind: "$history" },
      {
        $group: {
          _id: "$history.captured_at",
          total_interactions: { $sum: "$history.total_interactions" },
          reactions: { $sum: "$history.reactions" },
          comments: { $sum: "$history.comments" },
          shares: { $sum: "$history.shares" },
          posts_count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          captured_at: "$_id",
          total_interactions: 1,
          reactions: 1,
          comments: 1,
          shares: 1,
          posts_count: 1,
        },
      },
    ])
    .toArray();
}

/**
 * Supprime un poste.
 */
export async function deleteOwnPost(id) {
  const ownPosts = await collection();
  return await ownPosts.deleteOne({ id });
}

/**
 * Supprime tous mes postes.
 */
export async function deleteAllOwnPosts() {
  const ownPosts = await collection();
  return await ownPosts.deleteMany({});
}

/**
 * Nombre total de postes.
 */
export async function countOwnPosts() {
  const ownPosts = await collection();
  return await ownPosts.countDocuments();
}

/**
 * Vérifie si un poste existe.
 */
export async function ownPostExists(id) {
  const ownPosts = await collection();
  const count = await ownPosts.countDocuments({ id });
  return count > 0;
}

/**
 * Mes N postes les plus performants (interactions décroissantes), avec un
 * texte exploitable. Sert d'inspiration de "voix perso" à la génération IA
 * (voir generate.service.js) — pas au scoring des dimensions.
 */
export async function getTopOwnPostsByInteractions(limit = 5) {
  const ownPosts = await collection();
  return await ownPosts
    .find({ post_text: { $exists: true, $ne: "" } })
    .sort({ total_interactions: -1 })
    .limit(limit)
    .toArray();
}