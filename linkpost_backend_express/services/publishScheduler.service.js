import { publishDuePosts } from "./generate.service.js";

/**
 * Vérifie périodiquement si des postes générés programmés ("programme")
 * doivent être publiés sur LinkedIn, et les publie.
 *
 * Même principe que schedule.service.js (auto-sync de mes_postes) : vit
 * dans le PROCESSUS Node (le serveur Express), pas dans le navigateur —
 * la publication différée continue même si personne n'a d'onglet ouvert.
 * Seul un redémarrage du serveur l'arrête.
 */

const CHECK_INTERVAL_MS = 60 * 1000; // vérifie toutes les minutes

let timer = null;

async function tick() {
  try {
    const results = await publishDuePosts();
    if (results.length === 0) return;
    const ok = results.filter((r) => r.success).length;
    console.log(`[publishScheduler] ${ok}/${results.length} poste(s) programmé(s) publié(s).`);
    for (const r of results) {
      if (!r.success) console.error(`[publishScheduler] échec poste ${r.id} :`, r.message);
    }
  } catch (error) {
    console.error("[publishScheduler] échec :", error.message);
  }
}

/**
 * Démarre le vérificateur de publications programmées (appelé une fois
 * au démarrage du serveur, voir src/server.js).
 */
export function startPublishScheduler() {
  if (timer) return;
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  console.log(`[publishScheduler] Vérification des postes programmés toutes les ${CHECK_INTERVAL_MS / 1000}s.`);
}

export function stopPublishScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
