import { Router } from "express";

import {
  getConcurrents,
  addConcurrent,
  deleteConcurrent,
  getConcurrentPosts,
  importConcurrents,
  getImportCriteriaCtrl,
  saveImportCriteriaCtrl,
  startAutoImport,
  stopAutoImport,
  getAutoImportStatus,
} from "../controllers/concurrent.controller.js";

const router = Router();

/* --- Concurrents --- */
router.get("/", getConcurrents);
router.post("/", addConcurrent);
router.delete("/", deleteConcurrent); // ?url=...

router.get("/posts", getConcurrentPosts);

router.post("/import", importConcurrents);

router.get("/criteria", getImportCriteriaCtrl);
router.put("/criteria", saveImportCriteriaCtrl);

router.post("/schedule/start", startAutoImport);
router.post("/schedule/stop", stopAutoImport);
router.get("/schedule/status", getAutoImportStatus);

export default router;