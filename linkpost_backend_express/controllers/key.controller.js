import { getOverview, getDimensionDetail, getTimeline, getBestTimes, buildOverviewCsv } from "../services/key.service.js";


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


export async function bestTimes(req, res) {
  try {
    res.set("Cache-Control", "no-store");
    return res.status(200).json(await getBestTimes());
  } catch (error) {
    console.error("Erreur bestTimes :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


export async function exportCsv(req, res) {
  try {
    const csv = await buildOverviewCsv();
    const date = new Date().toISOString().slice(0, 10);
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="postgenius-rapport-${date}.csv"`);
    // BOM UTF-8 : Excel affiche correctement les accents sans ça sinon mal interprétés.
    return res.status(200).send("﻿" + csv);
  } catch (error) {
    console.error("Erreur exportCsv :", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}