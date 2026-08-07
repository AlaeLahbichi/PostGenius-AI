import {
  addConcurrentUrl,
  listConcurrents,
  removeConcurrent,
  listConcurrentPosts,
  importAllConcurrents,
  getCriteria,
  updateCriteria,
  startSchedule,
  stopSchedule,
  getScheduleStatus,
} from "../services/concurrent.service.js";

export async function getConcurrents(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, concurrents: await listConcurrents() });
  } catch (error) {
    console.error("Erreur getConcurrents :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function addConcurrent(req, res) {
  try {
    const { url, name = null } = req.body;
    const result = await addConcurrentUrl(url, name);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Erreur addConcurrent :", error);
    const client = error.message.includes("invalide");
    return res.status(client ? 400 : 500).json({ success: false, message: error.message });
  }
}

export async function deleteConcurrent(req, res) {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ success: false, message: "url est obligatoire." });
    return res.status(200).json(await removeConcurrent(url));
  } catch (error) {
    console.error("Erreur deleteConcurrent :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getConcurrentPosts(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const posts = await listConcurrentPosts();
    return res.status(200).json({ success: true, total: posts.length, posts });
  } catch (error) {
    console.error("Erreur getConcurrentPosts :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function importConcurrents(req, res) {
  try {
    return res.status(200).json(await importAllConcurrents());
  } catch (error) {
    console.error("Erreur importConcurrents :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
export async function getImportCriteriaCtrl(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, criteria: await getCriteria() });
  } catch (error) {
    console.error("Erreur getImportCriteria :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function saveImportCriteriaCtrl(req, res) {
  try {
    return res.status(200).json({ success: true, criteria: await updateCriteria(req.body || {}) });
  } catch (error) {
    console.error("Erreur saveImportCriteria :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function startAutoImport(req, res) {
  try {
    const { minutes = 5 } = req.body || {};
    return res.status(200).json(startSchedule(minutes));
  } catch (error) {
    console.error("Erreur startAutoImport :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function stopAutoImport(req, res) {
  try {
    return res.status(200).json(stopSchedule());
  } catch (error) {
    console.error("Erreur stopAutoImport :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAutoImportStatus(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(getScheduleStatus());
  } catch (error) {
    console.error("Erreur getAutoImportStatus :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}