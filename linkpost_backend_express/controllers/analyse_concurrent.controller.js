import {
  analyseOnePost,
  analyseAllConcurrentPosts,
  getAllAnalyses,
  getAnalysis,
} from "../services/analyse_concurrent.service.js";

export async function analyseOne(req, res) {
  try {
    const result = await analyseOnePost(req.params.postId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur analyseOne :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function analyseAll(req, res) {
  try {
    const result = await analyseAllConcurrentPosts();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur analyseAll :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function listAnalyses(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const analyses = await getAllAnalyses();
    return res.status(200).json({ success: true, total: analyses.length, analyses });
  } catch (error) {
    console.error("Erreur listAnalyses :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getOneAnalysis(req, res) {
  try {
    const analysis = await getAnalysis(req.params.postId);
    if (!analysis) {
      return res.status(404).json({ success: false, message: "Analyse introuvable pour ce post." });
    }
    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error("Erreur getOneAnalysis :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}