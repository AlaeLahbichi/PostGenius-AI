import {
  GEN_DIMS,
  listValues,
  getValueDoc,
  getPostsByIds,
  insertCreatedPost,
  listCreatedPosts,
  findCreatedPostById,
  updateCreatedPostStatus,
  findDueScheduledPosts,
} from "../repositories/generate.repository.js";
import { publishToLinkedIn } from "./linkedinPublish.service.js";
import { getTopOwnPostsByInteractions } from "../repositories/ownpost.repository.js";

/**
 * Statuts valides d'un poste généré :
 * - brouillon : généré mais pas encore partagé.
 * - programme : publication différée, publiée automatiquement à la date
 *               choisie (voir schedulePost / publishScheduler.service.js).
 * - shared    : réellement publié sur LinkedIn (voir shareGeneratedPost).
 * - supprime  : suppression douce, le poste reste en base mais n'apparaît
 *               plus que dans la liste des postes supprimés.
 */

/* ================================================================== */
/*  OpenRouter                                                         */
/* ================================================================== */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
const OPENROUTER_MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function canonical(v) {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Tronque une cha\u00eene sans jamais couper au milieu d'une paire de
 * substituts UTF-16 (emoji, etc.) \u2014 sinon on obtient un caract\u00e8re de
 * substitution isol\u00e9, invalide en UTF-8, que l'API OpenRouter/le
 * fournisseur du mod\u00e8le rejette (400 "Provider returned error").
 */
export function safeSlice(text, maxLen) {
  if (text.length <= maxLen) return text;
  let end = maxLen;
  if (end > 0 && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) {
    end -= 1;
  }
  return text.slice(0, end);
}

function extractJson(raw) {
  const cleaned = String(raw)
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

function getRetryDelayMs(response, attempt) {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 15000);
    const retryDate = Date.parse(retryAfter);
    if (!Number.isNaN(retryDate)) return Math.min(Math.max(retryDate - Date.now(), 0), 15000);
  }
  return Math.min(2000 * 2 ** attempt, 8000);
}

async function callOpenRouter(systemPrompt, userPrompt) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY est absente (backend).");

  for (let attempt = 0; attempt <= OPENROUTER_MAX_RETRIES; attempt += 1) {
    const aiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const responseText = await aiRes.text();
    let aiData = null;
    if (responseText) {
      try {
        aiData = JSON.parse(responseText);
      } catch {
        aiData = null;
      }
    }
    if (aiRes.ok) return aiData?.choices?.[0]?.message?.content ?? "";

    if (aiRes.status !== 429) {
      const detail = aiData?.error?.message || aiData?.message || responseText.slice(0, 500);
      throw new Error(`OpenRouter a répondu ${aiRes.status}${detail ? ` : ${detail}` : ""}.`);
    }
    if (attempt === OPENROUTER_MAX_RETRIES) throw new Error("Limite OpenRouter atteinte (429).");
    await sleep(getRetryDelayMs(aiRes, attempt));
  }
  throw new Error("Impossible de contacter OpenRouter.");
}

/* ================================================================== */
/*  Étape : valeurs + recommandations IA                              */
/* ================================================================== */

export async function getValues(key) {
  return listValues(key);
}

const RECO_SYSTEM = `Tu es un stratège éditorial LinkedIn senior. On te donne l'objectif d'un post et une liste de valeurs candidates pour une caractéristique éditoriale (pattern, hook, angle, style, ton ou format). Sélectionne les 2 valeurs les PLUS pertinentes pour atteindre cet objectif, en te basant sur ce qui fonctionne réellement sur LinkedIn pour ce type d'objectif — pas sur la première option venue.

Règles :
- Choisis UNIQUEMENT parmi la liste fournie, en recopiant le libellé EXACT (même casse, mêmes accents).
- Les deux valeurs choisies doivent être distinctes et, idéalement, complémentaires plutôt que redondantes.
- La raison est une phrase courte, concrète et en français correct, qui justifie le choix par rapport à l'objectif donné (pas une reformulation générique du libellé).

Réponds UNIQUEMENT en JSON, sans texte ni Markdown :
{"recommendations":[{"value":"...","reason":"1 phrase courte"},{"value":"...","reason":"1 phrase courte"}]}`;

/**
 * Recommande les 2 valeurs les plus proches de l'objectif (IA), avec repli.
 */
export async function recommend({ objective, key }) {
  const def = GEN_DIMS[key];
  if (!def) throw new Error("Dimension inconnue.");

  const values = await listValues(key);
  if (values.length === 0) return { success: true, key, recommendations: [] };

  const candidates = values.map((v) => v.value);
  const bySlug = new Map(values.map((v) => [v.slug, v.value]));

  const fallback = () =>
    values.slice(0, 2).map((v) => ({ value: v.value, reason: `Souvent utilisé (${v.usage_count}×).` }));

  if (!OPENROUTER_API_KEY || !objective) {
    return { success: true, key, recommendations: fallback(), ai: false };
  }

  try {
    const userPrompt = `OBJECTIF DU POST :
${objective}

CARACTÉRISTIQUE : ${def.label}
VALEURS CANDIDATES : ${candidates.join(" | ")}

Donne les 2 valeurs les plus pertinentes (issues de la liste), avec une raison courte.`;

    const content = await callOpenRouter(RECO_SYSTEM, userPrompt);
    const parsed = extractJson(content);
    const raw = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

    const seen = new Set();
    const recs = [];
    for (const r of raw) {
      const match = bySlug.get(canonical(r?.value));
      if (match && !seen.has(match)) {
        seen.add(match);
        recs.push({ value: match, reason: String(r?.reason ?? "").slice(0, 200) });
      }
      if (recs.length >= 2) break;
    }
    // Complète si l'IA a renvoyé moins de 2 valeurs valides.
    for (const v of values) {
      if (recs.length >= 2) break;
      if (!seen.has(v.value)) {
        seen.add(v.value);
        recs.push({ value: v.value, reason: `Souvent utilisé (${v.usage_count}×).` });
      }
    }

    return { success: true, key, recommendations: recs, ai: true };
  } catch {
    return { success: true, key, recommendations: fallback(), ai: false };
  }
}

/* ================================================================== */
/*  Posts liés à un critère                                           */
/* ================================================================== */

function shapePost(p) {
  const interactions = Number(p.total_interactions ?? (Number(p.reactions || 0) + Number(p.comments || 0))) || 0;
  return {
    id: p.id,
    url: p.url ?? null,
    user_name: p.user_name ?? null,
    date_posted: p.date_posted ?? null,
    interactions,
    text: String(p.post_text ?? "").trim(),
  };
}

export async function getRelated(key, value, limit = 8) {
  const doc = await getValueDoc(key, value);
  const ids = (doc?.post_ids || []).map(String);
  const posts = await getPostsByIds(ids);
  return posts
    .map(shapePost)
    .filter((p) => p.text)
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, limit);
}

/* ================================================================== */
/*  Génération du post                                                */
/* ================================================================== */

const GEN_SYSTEM = `Tu es un ghostwriter LinkedIn senior et stratège de contenu B2B francophone. Tu écris des publications LinkedIn originales, crédibles, claires et professionnelles, calibrées pour la portée et l'interaction, sans jamais tomber dans le "post IA" générique.

Principes de rédaction :
- Français impeccable : zéro faute d'orthographe, de grammaire ou de conjugaison. Relis mentalement avant de répondre.
- Première personne, ton humain et incarné — jamais un ton corporate creux ni un ton robotique.
- Cohérence logique de bout en bout : chaque phrase doit découler naturellement de la précédente, sans contradiction ni rupture de sujet.
- Première ligne = accroche (hook) qui donne envie de cliquer "voir plus", sans clickbait mensonger.
- Idées aérées : phrases courtes, sauts de ligne fréquents, une idée par ligne ou paragraphe.
- Tu appliques RIGOUREUSEMENT les caractéristiques imposées (pattern, hook, angle, styles, tons, format).
- Les exemples fournis servent UNIQUEMENT d'inspiration de registre, de structure et de rythme : tu ne copies JAMAIS une phrase, un chiffre, un nom propre ou une tournure spécifique.
- Si des extraits de MES posts les plus performants sont fournis (bloc "MA VOIX PERSO"), calque-toi sur mes tournures récurrentes, mon rythme de phrase et mon niveau de formalité habituel — c'est ma voix, pas un exemple générique du secteur. En cas de conflit avec les caractéristiques imposées, les caractéristiques imposées gagnent.
- Tu n'inventes AUCUN fait, chiffre, statistique, résultat ou citation qui ne t'a pas été fourni dans l'objectif ou l'audience. Si un exemple concret manque, reste général plutôt que d'halluciner un détail précis.
- Tu intègres des @mentions pertinentes et plausibles quand c'est naturel (personnes/entreprises), sans inventer de fausses citations.
- Zéro superlatif creux, zéro buzzword vide, 0 à 3 emojis maximum (seulement s'ils servent le propos).
- Évite les tournures qui trahissent un texte généré par IA, par exemple : "Dans le monde d'aujourd'hui", "Il est important de noter que", "En conclusion", "N'hésitez pas à", "Plongeons dans le sujet", ou toute phrase d'ouverture méta qui parle du post plutôt que d'entrer dans le sujet.
- 3 à 5 hashtags maximum, pertinents et spécifiques au sujet (pas de hashtags génériques du type #motivation #business), placés à la toute fin du texte.
- Si une intention (call to action) est fournie, tu termines par un appel à l'action clair et non racoleur.
- Longueur adaptée à LinkedIn et à la longueur demandée.

Sortie : UNIQUEMENT un objet JSON valide, sans texte ni Markdown autour :
{"post_text":"<le post complet, prêt à publier, avec des sauts de ligne \\n et les @mentions inline, SANS les hashtags dans le texte>","hashtags":["#..."],"mentions":["@..."]}`;

async function gatherExamples(selections, perTotalCap = 12) {
  const chosen = [];
  if (selections.pattern) chosen.push({ key: "pattern", value: selections.pattern, label: `Pattern : ${selections.pattern}` });
  if (selections.hook) chosen.push({ key: "hook", value: selections.hook, label: `Hook : ${selections.hook}` });
  if (selections.angle) chosen.push({ key: "angle", value: selections.angle, label: `Angle : ${selections.angle}` });
  for (const s of selections.styles || []) chosen.push({ key: "style", value: s, label: `Style : ${s}` });
  for (const t of selections.tones || []) chosen.push({ key: "tone", value: t, label: `Ton : ${t}` });
  for (const f of selections.formats || []) chosen.push({ key: "format", value: f, label: `Format : ${f}` });

  const idToMatched = new Map();
  for (const c of chosen) {
    const doc = await getValueDoc(c.key, c.value);
    for (const id of (doc?.post_ids || []).map(String)) {
      if (!idToMatched.has(id)) idToMatched.set(id, new Set());
      idToMatched.get(id).add(c.label);
    }
  }

  const allIds = [...idToMatched.keys()];
  const posts = await getPostsByIds(allIds);

  let examples = posts
    .map((p) => {
      const shaped = shapePost(p);
      return { ...shaped, matched: [...(idToMatched.get(String(p.id)) || [])] };
    })
    .filter((e) => e.text)
    .sort((a, b) => b.matched.length - a.matched.length || b.interactions - a.interactions)
    .slice(0, perTotalCap)
    .map((e) => ({ ...e, text: safeSlice(e.text, 600) }));

  return { chosen, examples, relatedCount: allIds.length };
}

/**
 * Extraits de MES posts les plus performants (mes_postes), utilisés comme
 * référence de "voix perso" à la génération — jamais copiés, juste imités
 * en registre/rythme. Best-effort : silencieux si aucun poste synchronisé.
 */
async function gatherVoiceExamples(limit = 3) {
  try {
    const posts = await getTopOwnPostsByInteractions(limit);
    return posts
      .map((p) => ({ text: String(p.post_text || "").trim(), interactions: p.total_interactions || 0 }))
      .filter((p) => p.text)
      .map((p) => ({ ...p, text: safeSlice(p.text, 500) }));
  } catch {
    return [];
  }
}

export async function generatePost(selections) {
  const objective = String(selections.objective || "").trim();
  if (!objective) throw new Error("L'objectif du post est obligatoire.");

  const { chosen, examples, relatedCount } = await gatherExamples(selections);
  const voiceExamples = await gatherVoiceExamples();

  const criteriaBlock = chosen.map((c) => `- ${c.label}`).join("\n") || "- (aucune caractéristique choisie)";
  const examplesBlock =
    examples.length > 0
      ? examples
          .map((e, i) => `Exemple ${i + 1} [${e.matched.join(", ")}] — ${e.interactions} interactions :\n"""${e.text}"""`)
          .join("\n\n")
      : "Aucun exemple disponible.";
  const voiceBlock =
    voiceExamples.length > 0
      ? voiceExamples
          .map((e, i) => `Extrait ${i + 1} (${e.interactions} interactions) :\n"""${e.text}"""`)
          .join("\n\n")
      : null;

  const lengthMap = { court: "court (60–120 mots)", moyen: "moyen (120–200 mots)", long: "long (200–320 mots)" };
  const lengthLabel = lengthMap[selections.length] || lengthMap.moyen;

  const userPrompt = `OBJECTIF DU POST :
${objective}
${selections.audience ? `\nAUDIENCE CIBLE : ${selections.audience}` : ""}${selections.cta ? `\nINTENTION / CALL TO ACTION : ${selections.cta}` : ""}
LONGUEUR SOUHAITÉE : ${lengthLabel}

CARACTÉRISTIQUES À RESPECTER :
${criteriaBlock}

EXEMPLES INSPIRANTS (posts réels ayant utilisé ces caractéristiques — inspiration de registre/structure UNIQUEMENT, ne rien copier) :
${examplesBlock}
${voiceBlock ? `\nMA VOIX PERSO (mes posts les plus performants — calque-toi sur mon style d'écriture, ne rien copier) :\n${voiceBlock}\n` : ""}
Rédige maintenant le nouveau post en respectant TOUTES les caractéristiques ci-dessus. Réponds uniquement avec l'objet JSON demandé.`;

  const content = await callOpenRouter(GEN_SYSTEM, userPrompt);

  let post_text = "";
  let hashtags = [];
  let mentions = [];
  try {
    const parsed = extractJson(content);
    post_text = String(parsed?.post_text ?? "").trim();
    hashtags = Array.isArray(parsed?.hashtags) ? parsed.hashtags : [];
    mentions = Array.isArray(parsed?.mentions) ? parsed.mentions : [];
  } catch {
    post_text = String(content || "").trim();
  }
  if (!post_text) throw new Error("Le modèle n'a pas renvoyé de texte.");

  return {
    success: true,
    post_text,
    hashtags,
    mentions,
    relatedCount,
    examplesUsed: examples.length,
    voiceExamplesUsed: voiceExamples.length,
  };
}

/* ================================================================== */
/*  Sauvegarde (brouillon / partagé)                                  */
/* ================================================================== */

// Taille max d'une image jointe (base64), pour éviter de saturer le
// document Mongo (limite dure : 16 Mo/doc) avec une seule photo.
const MAX_IMAGE_BASE64_LENGTH = 6 * 1024 * 1024; // ~4,5 Mo d'image décodée

export async function savePost(payload) {
  // Toujours enregistré en brouillon : le statut "shared" ne peut plus être
  // obtenu qu'en publiant réellement sur LinkedIn (voir shareGeneratedPost).
  const status = "brouillon";
  const post_text = String(payload.post_text ?? "").trim();
  if (!post_text) throw new Error("Le texte du post est vide.");

  const imageBase64 = payload.image_base64 ? String(payload.image_base64) : null;
  if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new Error("Image trop volumineuse (4,5 Mo max).");
  }

  const doc = {
    objective: payload.objective ?? null,
    audience: payload.audience ?? null,
    cta: payload.cta ?? null,
    length: payload.length ?? null,
    pattern: payload.pattern ?? null,
    hook: payload.hook ?? null,
    angle: payload.angle ?? null,
    styles: payload.styles ?? [],
    tones: payload.tones ?? [],
    formats: payload.formats ?? [],
    hashtags: payload.hashtags ?? [],
    mentions: payload.mentions ?? [],
    post_text,
    status,
    image_base64: imageBase64,
    image_mime_type: imageBase64 ? String(payload.image_mime_type || "image/jpeg") : null,
  };

  const id = await insertCreatedPost(doc);
  return { success: true, id, status };
}

export async function getCreated(statuses) {
  return listCreatedPosts(statuses);
}

// "shared" ne se met plus à jour directement : il faut passer par
// shareGeneratedPost, qui publie réellement sur LinkedIn avant de basculer
// le statut. Évite qu'un poste soit marqué "partagé" sans l'être vraiment.
const DIRECTLY_SETTABLE_STATUSES = ["brouillon", "supprime"];

/**
 * Change le statut d'un poste généré (brouillon <-> supprimé).
 */
export async function updateGeneratedPostStatus(id, status) {
  if (!id) throw new Error("id est obligatoire.");
  if (!DIRECTLY_SETTABLE_STATUSES.includes(status)) {
    throw new Error(
      status === "shared"
        ? "Utilise la publication (\"Partager\") pour passer un poste en partagé."
        : "Statut invalide."
    );
  }

  const existing = await findCreatedPostById(id);
  if (!existing) throw new Error("Poste introuvable.");

  await updateCreatedPostStatus(id, status);
  return { success: true, id, status };
}

/**
 * Publie réellement le poste sur LinkedIn, puis marque son statut "shared".
 * Si la publication échoue (token expiré, scope manquant, etc.), le statut
 * n'est pas modifié.
 */
export async function shareGeneratedPost(id) {
  if (!id) throw new Error("id est obligatoire.");

  const post = await findCreatedPostById(id);
  if (!post) throw new Error("Poste introuvable.");
  if (post.status === "supprime") {
    throw new Error("Impossible de partager un poste supprimé.");
  }

  const { linkedinPostId } = await publishToLinkedIn({
    post_text: post.post_text,
    hashtags: post.hashtags,
    imageBase64: post.image_base64 || null,
  });

  await updateCreatedPostStatus(id, "shared", {
    linkedin_post_id: linkedinPostId || null,
    scheduled_at: null,
  });

  return { success: true, id, status: "shared", linkedinPostId };
}

/* ================================================================== */
/*  Publication différée (programmation)                              */
/* ================================================================== */

/**
 * Programme la publication d'un brouillon à une date future : le statut
 * passe à "programme", et publishScheduler.service.js le publiera
 * automatiquement (via shareGeneratedPost) une fois la date atteinte.
 */
export async function schedulePost(id, scheduledAtRaw) {
  if (!id) throw new Error("id est obligatoire.");

  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Date de programmation invalide.");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("La date de programmation doit être dans le futur.");
  }

  const existing = await findCreatedPostById(id);
  if (!existing) throw new Error("Poste introuvable.");
  if (existing.status === "supprime") throw new Error("Impossible de programmer un poste supprimé.");
  if (existing.status === "shared") throw new Error("Ce poste est déjà publié.");

  await updateCreatedPostStatus(id, "programme", { scheduled_at: scheduledAt, schedule_error: null });
  return { success: true, id, status: "programme", scheduledAt: scheduledAt.toISOString() };
}

/**
 * Annule la programmation d'un poste : retour à "brouillon".
 */
export async function cancelSchedule(id) {
  if (!id) throw new Error("id est obligatoire.");

  const existing = await findCreatedPostById(id);
  if (!existing) throw new Error("Poste introuvable.");
  if (existing.status !== "programme") throw new Error("Ce poste n'est pas programmé.");

  await updateCreatedPostStatus(id, "brouillon", { scheduled_at: null });
  return { success: true, id, status: "brouillon" };
}

/**
 * Publie tous les postes programmés dont l'heure est arrivée. Appelé
 * périodiquement par publishScheduler.service.js — vit dans le process
 * Node, continue même si personne n'a d'onglet ouvert (même principe que
 * schedule.service.js pour l'auto-sync de mes_postes).
 *
 * Best-effort par poste : un échec (token expiré, scope manquant...) ne
 * bloque pas les autres et repasse le poste en brouillon avec l'erreur
 * tracée, plutôt que de retenter en boucle indéfiniment.
 */
export async function publishDuePosts() {
  const due = await findDueScheduledPosts();
  const results = [];

  for (const post of due) {
    const id = String(post._id);
    try {
      const r = await shareGeneratedPost(id);
      results.push({ id, success: true, linkedinPostId: r.linkedinPostId });
    } catch (error) {
      results.push({ id, success: false, message: error.message });
      await updateCreatedPostStatus(id, "brouillon", {
        scheduled_at: null,
        schedule_error: error.message,
      });
    }
  }

  return results;
}