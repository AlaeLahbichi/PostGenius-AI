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


router.post("/sync", syncMyPosts);


router.post("/compare", compareMyPosts);


router.get("/stats/global", getGlobalStats);



router.post("/schedule/start", startAutoSync);

router.post("/schedule/stop", stopAutoSync);

router.get("/schedule/status", getAutoSyncStatus);


router.get("/", getAllMyPosts);


router.get("/:id/history", getMyPostEvolution);

router.get("/:id", getMyPostById);


router.delete("/:id", removeMyPost);

export default router;