import { Router } from "express";

import {
  values,
  recommendCtrl,
  related,
  generateCtrl,
  saveCtrl,
  created,
  updateCreatedStatusCtrl,
  shareCreatedPostCtrl,
  linkedinStatusCtrl,
} from "../controllers/generate.controller.js";

const router = Router();

router.get("/values/:key", values);
router.post("/recommend", recommendCtrl);
router.get("/related", related);
router.post("/generate", generateCtrl);
router.post("/save", saveCtrl);
router.get("/created", created);
router.patch("/created/:id/status", updateCreatedStatusCtrl);
router.post("/created/:id/share", shareCreatedPostCtrl);
router.get("/linkedin-status", linkedinStatusCtrl);

export default router;