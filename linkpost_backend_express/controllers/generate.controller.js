import {
  getValues,
  recommend,
  getRelated,
  generatePost,
  savePost,
  getCreated,
  updateGeneratedPostStatus,
  shareGeneratedPost,
} from "../services/generate.service.js";
import { getTokenStatus } from "../services/linkedinPublish.service.js";

export async function linkedinStatusCtrl(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, ...getTokenStatus() });
  } catch (error) {
    console.error("Erreur linkedinStatus :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function values(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, key: req.params.key, values: await getValues(req.params.key) });
  } catch (error) {
    console.error("Erreur values :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function recommendCtrl(req, res) {
  try {
    const { objective = "", key } = req.body || {};
    return res.status(200).json(await recommend({ objective, key }));
  } catch (error) {
    console.error("Erreur recommend :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function related(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const { key, value } = req.query;
    if (!key || !value) return res.status(400).json({ success: false, message: "key et value sont obligatoires." });
    return res.status(200).json({ success: true, key, value, posts: await getRelated(key, value) });
  } catch (error) {
    console.error("Erreur related :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function generateCtrl(req, res) {
  try {
    return res.status(200).json(await generatePost(req.body || {}));
  } catch (error) {
    console.error("Erreur generate :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function saveCtrl(req, res) {
  try {
    return res.status(200).json(await savePost(req.body || {}));
  } catch (error) {
    console.error("Erreur save :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function created(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const { status } = req.query;
    const statuses = status
      ? String(status).split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const posts = await getCreated(statuses);
    return res.status(200).json({ success: true, total: posts.length, posts });
  } catch (error) {
    console.error("Erreur created :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateCreatedStatusCtrl(req, res) {
  try {
    const { status } = req.body || {};
    const result = await updateGeneratedPostStatus(req.params.id, status);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur updateCreatedStatus :", error);
    const isClient =
      error.message.includes("obligatoire") ||
      error.message.includes("invalide") ||
      error.message.includes("introuvable") ||
      error.message.includes("Utilise la publication");
    return res.status(isClient ? 400 : 500).json({ success: false, message: error.message });
  }
}

export async function shareCreatedPostCtrl(req, res) {
  try {
    const result = await shareGeneratedPost(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Erreur shareCreatedPost :", error);
    const isClient =
      error.message.includes("obligatoire") ||
      error.message.includes("introuvable") ||
      error.message.includes("supprimé");
    return res.status(isClient ? 400 : 502).json({ success: false, message: error.message });
  }
}