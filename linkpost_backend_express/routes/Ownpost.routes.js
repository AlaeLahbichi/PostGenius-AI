import { Router } from "express";

import {
  syncMyPosts,
  getAllMyPosts,
  getGlobalStats,
  compareMyPosts,
  getMyPostEvolution,
  getMyPostById,
  removeMyPost,
  startAutoSync,
  stopAutoSync,
  getAutoSyncStatus,
} from "../controllers/ownpost.controller.js";

const router = Router();

/**
 * IMPORTANT : les routes "fixes" (/sync, /compare,
 * /stats/global) sont déclarées AVANT /:id sinon
 * Express les interprète comme des identifiants.
 */

/**
 * Synchroniser MES postes (Bright Data -> MongoDB).
 * POST /ownposts/sync
 */
router.post("/sync", syncMyPosts);

/**
 * Comparer deux postes.
 * POST /ownposts/compare
 */
router.post("/compare", compareMyPosts);

/**
 * Statistiques globales + évolution.
 * GET /ownposts/stats/global
 */
router.get("/stats/global", getGlobalStats);

/**
 * Auto-sync (planificateur côté serveur).
 * POST /ownposts/schedule/start   body { profileUrl, minutes? }
 * POST /ownposts/schedule/stop
 * GET  /ownposts/schedule/status
 */

router.post("/schedule/start", startAutoSync);

router.post("/schedule/stop", stopAutoSync);

router.get("/schedule/status", getAutoSyncStatus);

/**
 * Tous mes postes.
 * GET /ownposts
 */
router.get("/", getAllMyPosts);

/**
 * Évolution d'un poste précis.
 * GET /ownposts/:id/history
 */
router.get("/:id/history", getMyPostEvolution);

/**
 * Un poste par id.
 * GET /ownposts/:id
 */
router.get("/:id", getMyPostById);

/**
 * Supprimer un poste.
 * DELETE /ownposts/:id
 */
router.delete("/:id", removeMyPost);

export default router;