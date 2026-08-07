import { Router } from "express";

import {
  values,
  recommendCtrl,
  related,
  generateCtrl,
  saveCtrl,
  created,
} from "../controllers/generate.controller.js";

const router = Router();

router.get("/values/:key", values);
router.post("/recommend", recommendCtrl);
router.get("/related", related);
router.post("/generate", generateCtrl);
router.post("/save", saveCtrl);
router.get("/created", created);

export default router;