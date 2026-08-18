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
  scheduleCtrl,
  cancelScheduleCtrl,
  imageCtrl,
} from "../controllers/generate.controller.js";

const router = Router();

router.get("/values/:key", values);
router.post("/recommend", recommendCtrl);
router.get("/related", related);
router.post("/generate", generateCtrl);
router.post("/save", saveCtrl);
router.get("/created", created);
router.patch("/created/:id/status", updateCreatedStatusCtrl);
router.get("/created/:id/images/:index", imageCtrl);
router.post("/created/:id/share", shareCreatedPostCtrl);
router.post("/created/:id/schedule", scheduleCtrl);
router.post("/created/:id/schedule/cancel", cancelScheduleCtrl);
router.get("/linkedin-status", linkedinStatusCtrl);

export default router;