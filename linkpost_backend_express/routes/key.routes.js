import { Router } from "express";

import { overview, dimension, timeline, bestTimes, exportCsv } from "../controllers/key.controller.js";

const router = Router();

router.get("/overview", overview);
router.get("/timeline", timeline);
router.get("/dimension/:key", dimension);
router.get("/best-times", bestTimes);
router.get("/export.csv", exportCsv);

export default router;