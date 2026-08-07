import { Router } from "express";

import {
  analyseOne,
  analyseAll,
  listAnalyses,
  getOneAnalysis,
} from "../controllers/analyse_concurrent.controller.js";

const router = Router();

router.post("/all", analyseAll);

router.get("/", listAnalyses);

router.post("/:postId", analyseOne);

router.get("/:postId", getOneAnalysis);

export default router;