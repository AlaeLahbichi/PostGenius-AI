import { syncOwnPosts } from "./ownpost.service.js";

/**
 * Planificateur de synchronisation automatique.
 *
 * IMPORTANT : ce minuteur vit dans le PROCESSUS Node
 * (le serveur Express), pas dans le navigateur.
 *
 * Conséquence : l'auto-update continue même si l'utilisateur
 * change de page, actualise (F5) ou ferme complètement son
 * navigateur. Seul un redémarrage du serveur l'arrête.
 *
 * L'état est en mémoire (voir note en bas pour le rendre
 * persistant au redémarrage du serveur).
 */

let timer = null;
let running = false;
let profileUrl = null;
let intervalMs = 5 * 60 * 1000; // 5 min par défaut
let nextRun = null;
let lastRun = null;
let lastError = null;
let lastTotalFetched = null;

/**
 * Secondes restantes avant la prochaine exécution.
 */
function secondsLeft() {
  if (!nextRun) return null;
  return Math.max(0, Math.round((nextRun.getTime() - Date.now()) / 1000));
}

/**
 * Une exécution de la synchronisation.
 */
async function runOnce() {
  try {
    lastRun = new Date();
    const result = await syncOwnPosts(profileUrl);
    lastTotalFetched = result.totalFetched ?? 0;
    lastError = null;
    console.log(
      `[schedule] Sync auto OK — ${lastTotalFetched} poste(s) à ${lastRun.toISOString()}`
    );
  } catch (error) {
    lastError = error.message;
    console.error("[schedule] Sync auto échouée :", error.message);
  } finally {
    nextRun = new Date(Date.now() + intervalMs);
  }
}

/**
 * Démarre (ou redémarre) la synchronisation automatique.
 */
export function startSchedule(url, minutes = 5) {
  if (!url) {
    throw new Error("profileUrl est obligatoire pour planifier la synchronisation.");
  }

  stopSchedule();

  profileUrl = url;
  intervalMs = Math.max(1, Number(minutes) || 5) * 60 * 1000;
  running = true;
  nextRun = new Date(Date.now() + intervalMs);

  // La première sync auto aura lieu dans `minutes`.
  // (Pour un rafraîchissement immédiat, l'utilisateur
  //  dispose du bouton "Mettre à jour".)
  timer = setInterval(runOnce, intervalMs);

  console.log(`[schedule] Auto-sync activée toutes les ${minutes} min pour ${url}`);

  return getScheduleStatus();
}

/**
 * Arrête la synchronisation automatique.
 */
export function stopSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
  nextRun = null;
  return getScheduleStatus();
}

/**
 * État courant du planificateur (consommé par le dashboard).
 */
export function getScheduleStatus() {
  return {
    success: true,
    running,
    profileUrl,
    intervalMinutes: intervalMs / 60000,
    nextRun,
    lastRun,
    lastError,
    lastTotalFetched,
    secondsLeft: secondsLeft(),
  };
}

/*
 * ------------------------------------------------------------------
 * Rendre l'auto-sync persistante au redémarrage du serveur (option) :
 *
 *   1. Sauvegarder { running, profileUrl, intervalMinutes } dans une
 *      collection MongoDB (ex. "settings") à chaque start/stop.
 *   2. Dans server.js, après connectMongo(), lire ce document et
 *      rappeler startSchedule(profileUrl, intervalMinutes) si running.
 *
 * Dis-le moi si tu veux cette version, je l'ajoute.
 * ------------------------------------------------------------------
 */