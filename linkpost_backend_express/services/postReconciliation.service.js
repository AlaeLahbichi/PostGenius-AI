/**
 * Ferme la boucle entre un poste généré (post_created) publié sur LinkedIn
 * et sa version réelle, une fois resynchronisée dans mes_postes.
 *
 * Sans ça, "Caractéristiques" n'apprend QUE des posts concurrents analysés
 * — jamais des vrais résultats des posts qu'on a nous-mêmes publiés via
 * l'app. Une fois le lien fait, les mêmes dimensions (pattern, hook,
 * angle, styles, tons, formats) utilisées pour générer le poste sont
 * appliquées à son id réel dans dim_*, exactement comme le fait l'analyse
 * concurrentielle — le scoring existant (key.service.js) les prend alors
 * en compte automatiquement, sans rien changer côté scoring.
 */
import { applyDimensionValue } from "../repositories/analyse_concurrent.repository.js";
import {
  canonical,
  findUnlinkedSharedPosts,
  linkCreatedPostToOwnPost,
} from "../repositories/generate.repository.js";

// Mêmes dimensions que GEN_DIMS (generate.repository.js), mais indexées
// sur les noms de champs du document post_created.
const DIMENSION_FIELDS = [
  { field: "pattern", list: false, collection: "dim_patterns" },
  { field: "hook", list: false, collection: "dim_hooks" },
  { field: "angle", list: false, collection: "dim_angles" },
  { field: "styles", list: true, collection: "dim_styles" },
  { field: "tones", list: true, collection: "dim_tones" },
  { field: "formats", list: true, collection: "dim_formats" },
];

// Nombre de caractères de texte normalisé comparés pour matcher un poste
// généré à sa version réelle. Les hashtags sont ajoutés à la publication
// réelle (voir linkedinPublish.service.js), donc pas de comparaison exacte
// possible — un préfixe suffisamment long évite les faux positifs.
const MATCH_PREFIX_LENGTH = 80;

export function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cherche, parmi les postes fraîchement synchronisés, celui qui correspond
 * à un poste généré marqué "shared" mais pas encore relié.
 */
export function findMatch(createdPost, ownPosts) {
  const prefix = normalizeText(createdPost.post_text).slice(0, MATCH_PREFIX_LENGTH);
  if (!prefix) return null;
  return ownPosts.find((p) => p.id && normalizeText(p.post_text).startsWith(prefix)) || null;
}

async function applyPostDimensions(createdPost, ownPostId) {
  for (const dim of DIMENSION_FIELDS) {
    const raw = createdPost[dim.field];
    const values = dim.list ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];

    for (const rawValue of values) {
      const value = String(rawValue || "").trim();
      if (!value) continue;
      const slug = canonical(value);
      if (!slug) continue;
      await applyDimensionValue(dim.collection, { value, slug }, ownPostId);
    }
  }
}

/**
 * À appeler après chaque synchronisation de mes_postes (manuelle ou
 * planifiée). Best-effort : une erreur ici ne doit jamais faire échouer
 * la synchronisation elle-même.
 */
export async function reconcilePublishedPosts(syncedOwnPosts) {
  if (!Array.isArray(syncedOwnPosts) || syncedOwnPosts.length === 0) {
    return { linked: 0 };
  }

  const pending = await findUnlinkedSharedPosts();
  if (pending.length === 0) return { linked: 0 };

  let linked = 0;
  for (const created of pending) {
    const match = findMatch(created, syncedOwnPosts);
    if (!match) continue;

    await linkCreatedPostToOwnPost(created._id, match.id);
    await applyPostDimensions(created, match.id);
    linked += 1;
  }

  return { linked };
}
