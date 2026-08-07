import {
  findAllPostAnalyses,
  findPostAnalysisByPostId,
} from "../repositories/postAnalyse.repository.js";

import {
  saveAnalysis,
  removeAnalysis,
  getVocabulary,
  getInsights,
} from "../services/analysis.service.js";


export async function savePostAnalysis(req, res) {
  try {
    const analysis = req.body;

    if (!analysis || !analysis.post_id) {
      return res.status(400).json({ success: false, message: "post_id est obligatoire." });
    }

    const result = await saveAnalysis(analysis);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur savePostAnalysis :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function getAllPostAnalyses(req, res) {
  try {
    const analyses = await findAllPostAnalyses();
    return res.status(200).json({ success: true, total: analyses.length, analyses });
  } catch (error) {
    console.error("Erreur getAllPostAnalyses :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function getPostAnalysis(req, res) {
  try {
    const analysis = await findPostAnalysisByPostId(req.params.postId);

    if (!analysis) {
      return res.status(404).json({ success: false, message: "Analyse introuvable pour ce post." });
    }

    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error("Erreur getPostAnalysis :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function removePostAnalysis(req, res) {
  try {
    const result = await removeAnalysis(req.params.postId);

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, deleted: 0, message: "Analyse introuvable." });
    }

    return res.status(200).json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error("Erreur removePostAnalysis :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function getAnalysisVocabulary(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(await getVocabulary());
  } catch (error) {
    console.error("Erreur getAnalysisVocabulary :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function getAnalysisInsights(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(await getInsights());
  } catch (error) {
    console.error("Erreur getAnalysisInsights :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}