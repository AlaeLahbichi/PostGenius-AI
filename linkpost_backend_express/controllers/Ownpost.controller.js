import {
  syncOwnPosts,
  getOwnPostsGlobalStats,
  getOwnPostEvolution,
  compareOwnPosts,
} from "../services/ownpost.service.js";

import {
  findAllOwnPosts,
  findOwnPostById,
  deleteOwnPost,
} from "../repositories/ownpost.repository.js";

import {
  startSchedule,
  stopSchedule,
  getScheduleStatus,
} from "../services/schedule.service.js";

/**
 * Synchroniser MES postes LinkedIn.
 * Bright Data -> MongoDB (collection mes_postes) avec historique.
 *
 * POST /ownposts/sync
 * body : { profileUrl, startDate?, endDate? }
 */
export async function syncMyPosts(req, res) {
  try {
    const { profileUrl, startDate = null, endDate = null } = req.body;

    if (!profileUrl) {
      return res.status(400).json({ success: false, message: "profileUrl est obligatoire." });
    }

    const result = await syncOwnPosts(profileUrl, { startDate, endDate });

    if (result.async) {
      return res.status(202).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur syncMyPosts :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Lire tous mes postes enregistrés.
 *
 * GET /ownposts
 */
export async function getAllMyPosts(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const posts = await findAllOwnPosts();
    return res.status(200).json({ success: true, total: posts.length, posts });
  } catch (error) {
    console.error("Erreur getAllMyPosts :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Statistiques globales + évolution.
 *
 * GET /ownposts/stats/global
 */
export async function getGlobalStats(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const stats = await getOwnPostsGlobalStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error("Erreur getGlobalStats :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Comparer deux postes.
 *
 * POST /ownposts/compare
 * body : { postIdA, postIdB }
 */
export async function compareMyPosts(req, res) {
  try {
    const { postIdA, postIdB } = req.body;
    const result = await compareOwnPosts(postIdA, postIdB);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur compareMyPosts :", error);
    const isClient =
      error.message.includes("obligatoires") || error.message.includes("introuvable");
    return res.status(isClient ? 400 : 500).json({ success: false, message: error.message });
  }
}

/**
 * Détail + évolution d'un poste.
 *
 * GET /ownposts/:id/history
 */
export async function getMyPostEvolution(req, res) {
  try {
    const result = await getOwnPostEvolution(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Poste introuvable." });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur getMyPostEvolution :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Lire un poste par son id.
 *
 * GET /ownposts/:id
 */
export async function getMyPostById(req, res) {
  try {
    const post = await findOwnPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Poste introuvable." });
    }
    return res.status(200).json({ success: true, post });
  } catch (error) {
    console.error("Erreur getMyPostById :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Supprimer un poste.
 *
 * DELETE /ownposts/:id
 */
export async function removeMyPost(req, res) {
  try {
    const result = await deleteOwnPost(req.params.id);
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, deleted: 0, message: "Poste introuvable." });
    }
    return res.status(200).json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error("Erreur removeMyPost :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/* ------------------------------------------------------------------ */
/* Synchronisation automatique (planificateur côté serveur)           */
/* ------------------------------------------------------------------ */

/**
 * Activer l'auto-sync (tourne côté serveur, survit au refresh).
 *
 * POST /ownposts/schedule/start
 * body : { profileUrl, minutes? }
 */
export async function startAutoSync(req, res) {
  try {
    const { profileUrl, minutes = 5 } = req.body;
    if (!profileUrl) {
      return res.status(400).json({ success: false, message: "profileUrl est obligatoire." });
    }
    const status = startSchedule(profileUrl, minutes);
    return res.status(200).json(status);
  } catch (error) {
    console.error("Erreur startAutoSync :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Désactiver l'auto-sync.
 *
 * POST /ownposts/schedule/stop
 */
export async function stopAutoSync(req, res) {
  try {
    return res.status(200).json(stopSchedule());
  } catch (error) {
    console.error("Erreur stopAutoSync :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * État du planificateur (running, prochaine exécution, etc.).
 *
 * GET /ownposts/schedule/status
 */
export async function getAutoSyncStatus(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(getScheduleStatus());
  } catch (error) {
    console.error("Erreur getAutoSyncStatus :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}