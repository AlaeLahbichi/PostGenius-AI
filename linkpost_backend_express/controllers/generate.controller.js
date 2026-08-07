import {
  getValues,
  recommend,
  getRelated,
  generatePost,
  savePost,
  getCreated,
} from "../services/generate.service.js";


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
    const posts = await getCreated();
    return res.status(200).json({ success: true, total: posts.length, posts });
  } catch (error) {
    console.error("Erreur created :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}