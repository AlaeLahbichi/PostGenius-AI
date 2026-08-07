import { getOverview, getDimensionDetail, getTimeline } from "../services/key.service.js";


export async function overview(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(await getOverview());
  } catch (error) {
    console.error("Erreur overview :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function dimension(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(await getDimensionDetail(req.params.key));
  } catch (error) {
    console.error("Erreur dimension :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function timeline(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    const { dim, value = null, granularity = "day" } = req.query;
    return res.status(200).json(await getTimeline({ dimKey: dim, value, granularity }));
  } catch (error) {
    console.error("Erreur timeline :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}