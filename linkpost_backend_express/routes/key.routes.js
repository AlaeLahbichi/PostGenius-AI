import { Router } from "express";

import { overview, dimension, timeline } from "../controllers/key.controller.js";

const router = Router();

router.get("/overview", overview);
router.get("/timeline", timeline);
router.get("/dimension/:key", dimension);

export default router;