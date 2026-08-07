import {
  findConcurrentPostById,
  findAllConcurrentPosts,
  analysisExists,
  findPostAnalysisByPostId,
  findAllPostAnalyses,
  upsertPostAnalysis,
  applyDimensionValue,
  listDimensionValues,
} from "../repositories/analyse_concurrent.repository.js";

/* ================================================================== */
/*  Dimensions : champ d'analyse -> collection dédiée                  */
/* ================================================================== */

const DIMENSIONS = [
  { key: "format", field: "format", list: false, collection: "dim_formats" },
  { key: "type", field: "type_post", list: false, collection: "dim_types" },
  { key: "angle", field: "angle_attaque", list: false, collection: "dim_angles" },
  { key: "hook", field: "hook_type", list: false, collection: "dim_hooks" },
  { key: "pattern", field: "pattern", list: false, collection: "dim_patterns" },
  { key: "style", field: "style", list: true, collection: "dim_styles" },
  { key: "tone", field: "ton", list: true, collection: "dim_tones" },
  { key: "tool", field: "outils", list: true, collection: "dim_tools" },
  { key: "structure", field: "structure", list: true, collection: "dim_structures" },
  { key: "keyword", field: "mots_cles", list: true, collection: "dim_keywords" },
];

/**
 * Clé canonique : minuscule, sans accents, sans ponctuation.
 * "Annonce" et "annonce" -> même slug "annonce".
 */
function canonical(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Valeurs propres et dédoublonnées d'une dimension pour une analyse.
 */
function valuesFor(analysis, dim) {
  const raw = analysis?.[dim.field];
  const arr = dim.list ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];

  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const value = String(v ?? "").trim();
    if (!value) continue;
    const slug = canonical(value);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ value, slug });
  }
  return out;
}

/* ================================================================== */
/*  Vocabulaire déjà utilisé (injecté dans le prompt)                  */
/* ================================================================== */

async function getVocabulary(limitPerDim = 40) {
  const vocabulary = {};
  for (const dim of DIMENSIONS) {
    const values = await listDimensionValues(dim.collection, limitPerDim);
    vocabulary[dim.key] = values.map((v) => v.value);
  }
  return vocabulary;
}

/* ================================================================== */
/*  OpenRouter — même analyse que la page                              */
/* ================================================================== */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
const OPENROUTER_MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const ANALYSIS_SYSTEM_PROMPT = `Tu es un expert en analyse de contenu LinkedIn, en copywriting et en stratégie éditoriale.

L'utilisateur va te transmettre les données d'une ou plusieurs publications LinkedIn. Ces données peuvent contenir :
- le texte de la publication ;
- le type de média ;
- une image, une vidéo ou un carrousel ;
- des statistiques ;
- des métadonnées associées à la publication.

Ta mission est d'analyser chaque publication et d'identifier ses principales caractéristiques éditoriales, rédactionnelles et stratégiques.

Objectif de STANDARDISATION (très important) :
- Les valeurs de catégorie (format, type_post, style, ton, angle_attaque, hook_type, pattern, outils, structure, mots_cles) doivent être des libellés COURTS, GÉNÉRIQUES et RÉUTILISABLES d'une publication à l'autre.
- Un message utilisateur peut te fournir un "VOCABULAIRE DÉJÀ UTILISÉ". Dans ce cas, réutilise EXACTEMENT ces libellés lorsqu'ils conviennent, au lieu d'inventer un synonyme. N'invente un nouveau libellé que si aucun existant ne convient.
- Les champs "explication_*" restent, eux, entièrement personnalisés et propres au post analysé.

Tu dois obligatoirement extraire les éléments suivants pour chaque publication :

1. Format — TEXT, IMAGE, VIDEO, CAROUSEL, POLL, DOCUMENT, LINK ou AUTRE. Déterminé uniquement à partir des données fournies.
2. Type de post — objectif éditorial principal (EDUCATIF, ACTUALITE_INSTITUTIONNELLE, PROMOTIONNEL, INSPIRANT, STORYTELLING, OPINION, RETOUR_EXPERIENCE, ETUDE_DE_CAS, TUTORIEL, LISTE, ACTUALITE, RECRUTEMENT, EVENEMENT, TEMOIGNAGE, ou AUTRE si aucune valeur ne correspond).
3. Style rédactionnel — un ou plusieurs styles (professionnel, institutionnel, conversationnel, pédagogique, narratif, provocateur, analytique, émotionnel, humoristique, valorisant, direct, concis, détaillé, authentique, persuasif...).
4. Angle d'attaque — le nom général, court et réutilisable de la stratégie éditoriale ou persuasive utilisée par l'auteur pour traiter son sujet.
Le champ "angle_attaque" doit :
- nommer une stratégie générale ;
- être court et clairement identifiable ;
- être formulé comme une catégorie stratégique ;
- pouvoir être réutilisé pour analyser d'autres publications ;
- être indépendant du sujet précis du post ;
- contenir idéalement entre 2 et 6 mots ;
- ne pas contenir de phrase explicative ;
- ne pas citer les technologies, produits, marques, personnes ou éléments propres au post ;
- ne jamais être une répétition ou un résumé du sujet.
Exemples d'angles d'attaque valides :
- "Preuve par l'innovation"
- "Approche centrée utilisateur"
- "Démonstration par les résultats"
- "Résolution d'un problème concret"
- "Valorisation de l'expertise"
- "Retour d'expérience"
- "Pédagogie par l'exemple"
- "Remise en question"
- "Preuve sociale"
- "Projection vers le futur"
- "Comparaison stratégique"
- "Transformation avant-après"
- "Création d'urgence"
- "Storytelling personnel"
- "Leadership d'opinion"
- "Valorisation institutionnelle"
- "Démonstration par la preuve"
- "Sensibilisation par les conséquences"
Le champ "explication_angle_attaque" doit ensuite expliquer précisément comment cet angle général est appliqué dans la publication, en citant ou en reformulant uniquement les éléments réellement présents dans le post.
5. Hook — la phrase ou les premières lignes utilisées pour attirer l'attention, reprises directement du texte lorsque possible.
6. Type de hook (hook_type) — la CATÉGORIE courte et réutilisable de l'accroche, indépendante du sujet. Exemples : "Question provocante", "Statistique choc", "Anecdote personnelle", "Annonce", "Résultat chiffré", "Promesse", "Contradiction", "Citation", "Storytelling d'ouverture", "Constat sectoriel", "Erreur courante". Le champ "explication_hook" justifie le hook et son type.
7. Pattern — le nom court et réutilisable du schéma de copywriting utilisé (ex: Problème – Agitation – Solution, Avant – Après – Pont, Erreur – Leçon – Solution...).
8. Ton — un ou plusieurs tons dominants (éducatif, fier, célébratoire, reconnaissant, institutionnel, provocateur, inspirant, critique, rassurant, enthousiaste, empathique, humoristique, neutre, autoritaire, optimiste...).
9. Structure — la décomposition du post en parties, dans l'ordre d'apparition (hook, contexte, problème, développement, exemple, liste, preuve, solution, résultat, conclusion, appel à l'action, remerciement...).
10. Outils (outils) — la liste des technologies, produits, méthodes, frameworks ou outils réellement cités dans le post (ex: "U-Net++", "FastAPI", "Grad-CAM"). Chaque outil est nommé tel qu'il apparaît. Liste vide si aucun.
11. Appel à l'action — la demande faite au lecteur, ou null si absente.
12. Résumé — un résumé court et fidèle, sans information absente du post.
13. Mots-clés — les principales entités, thématiques, marques ou sujets présents.

Règles obligatoires :
- Analyse uniquement les informations réellement présentes, n'invente rien.
- Chaque champ principal doit être suivi d'un champ d'explication qui justifie la valeur choisie.
- Utilise null pour une valeur indéterminable, et une liste vide pour une liste indéterminable.
- Le champ "format" est en MAJUSCULES ; le champ "type_post" est en MAJUSCULES_AVEC_UNDERSCORES.
- La réponse est rédigée entièrement en français.
- La réponse contient UNIQUEMENT un objet JSON valide : aucun texte avant ou après, aucun bloc Markdown, aucune balise \`\`\`json, aucun commentaire.
- Respecte exactement les noms de champs demandés dans le message utilisateur.`;

function buildVocabBlock(vocab) {
  if (!vocab) return "";
  const labels = {
    hook: "Types de hook",
    pattern: "Patterns",
    angle: "Angles d'attaque",
    style: "Styles",
    tone: "Tons",
    tool: "Outils",
    format: "Formats",
    type: "Types de post",
    structure: "Structures",
    keyword: "Mots-clés",
  };
  const lines = [];
  for (const key of Object.keys(labels)) {
    const arr = vocab[key];
    if (Array.isArray(arr) && arr.length > 0) {
      lines.push(`- ${labels[key]} : ${arr.join(" | ")}`);
    }
  }
  if (lines.length === 0) return "";
  return `\nVOCABULAIRE DÉJÀ UTILISÉ (réutilise EXACTEMENT ces libellés quand c'est pertinent, au lieu d'inventer un synonyme) :\n${lines.join(
    "\n"
  )}\n`;
}

function buildAnalysisUserPrompt(postsJson, vocab) {
  return `Analyse toutes les publications LinkedIn contenues dans les données JSON ci-dessous.
Ta mission est de produire une analyse éditoriale et stratégique distincte pour chaque publication.
${buildVocabBlock(vocab)}
Consignes obligatoires :
- Analyse chaque publication séparément. Ne mélange jamais les informations de plusieurs publications.
- Utilise principalement le champ "post_text" pour analyser le contenu.
- Si "post_text" est absent ou vide, utilise "original_post_text", puis "headline" en dernier recours.
- Utilise les champs "images", "videos", "document_page_count", "document_cover_image" et "post_type" pour déterminer le format réel.
- N'utilise jamais le nombre de réactions ou de commentaires pour déterminer le style, le ton ou le pattern.
- N'invente aucune information absente des données.
- Conserve l'identifiant et l'URL de chaque publication afin de relier l'analyse au post original.
- Retourne une analyse pour chaque publication, même lorsque certaines informations sont impossibles à déterminer (utilise null ou une liste vide).
- Le champ "pattern" doit contenir un nom court, clair et réutilisable ; "explication_pattern" doit expliquer les étapes du pattern.
- Le champ "hook_type" doit contenir une catégorie d'accroche courte et réutilisable.
- Le champ "outils" liste uniquement les outils/technologies réellement cités.
- Chaque champ d'analyse doit avoir son champ d'explication correspondant.
- La réponse est rédigée entièrement en français et contient UNIQUEMENT un objet JSON valide, sans texte ni Markdown avant ou après.

Règles de détermination du format :
- Si "videos" contient une ou plusieurs vidéos → "VIDEO".
- Si "document_page_count" > 0 ou "document_cover_image" renseigné → "CAROUSEL".
- Si le type de publication indique clairement un sondage → "POLL".
- Si "images" contient une ou plusieurs images sans document ni vidéo → "IMAGE".
- Si aucun média n'est présent et que la publication contient uniquement du texte → "TEXT".
- Si le format reste impossible à identifier → "AUTRE".

Correspondance des identifiants :
- "post_id" reçoit la valeur du champ "id" de la publication (ou "_id" si "id" est absent).
- "post_url" reçoit la valeur du champ "url".

La réponse doit respecter EXACTEMENT cette structure :
{
  "analyses": [
    {
      "post_id": null,
      "post_url": null,
      "format": null,
      "explication_format": null,
      "type_post": null,
      "explication_type_post": null,
      "style": [],
      "explication_style": null,
      "angle_attaque": null,
      "explication_angle_attaque": null,
      "hook": null,
      "hook_type": null,
      "explication_hook": null,
      "pattern": null,
      "explication_pattern": null,
      "ton": [],
      "explication_ton": null,
      "structure": [],
      "explication_structure": null,
      "outils": [],
      "explication_outils": null,
      "appel_action": null,
      "explication_appel_action": null,
      "resume": null,
      "explication_resume": null,
      "mots_cles": [],
      "explication_mots_cles": null
    }
  ]
}

Voici les publications à analyser :
${postsJson}`;
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

async function callOpenRouter(userPrompt) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY est absente (backend).");

  for (let attempt = 0; attempt <= OPENROUTER_MAX_RETRIES; attempt += 1) {
    const aiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
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

    if (aiRes.ok) return aiData;

    const providerMessage =
      typeof aiData?.error?.message === "string"
        ? aiData.error.message
        : typeof aiData?.message === "string"
          ? aiData.message
          : null;

    if (aiRes.status !== 429) {
      throw new Error(providerMessage ? `OpenRouter (${aiRes.status}) : ${providerMessage}` : `OpenRouter a répondu avec le statut ${aiRes.status}.`);
    }
    if (attempt === OPENROUTER_MAX_RETRIES) {
      throw new Error(providerMessage ? `Limite OpenRouter atteinte (429) : ${providerMessage}` : "Limite OpenRouter atteinte (429).");
    }
    await sleep(getRetryDelayMs(aiRes, attempt));
  }
  throw new Error("Impossible de contacter OpenRouter.");
}

/* ================================================================== */
/*  Extraction des caractéristiques -> dimensions                      */
/* ================================================================== */

async function storeCharacteristics(analysis, postId) {
  const dimensionErrors = [];
  for (const dim of DIMENSIONS) {
    try {
      for (const v of valuesFor(analysis, dim)) {
        await applyDimensionValue(dim.collection, v, postId);
      }
    } catch (e) {
      dimensionErrors.push({ dimension: dim.key, message: e.message });
    }
  }
  return dimensionErrors;
}

/* ================================================================== */
/*  Analyse d'UN post (une seule fois)                                 */
/* ================================================================== */

export async function analyseOnePost(postId) {
  if (!postId) throw new Error("postId est obligatoire.");

  // 1) Déjà analysé ? -> on ne relance pas.
  if (await analysisExists(postId)) {
    return { success: true, skipped: true, reason: "already-analyzed", post_id: postId };
  }

  // 2) Récupérer le post du concurrent.
  const post = await findConcurrentPostById(postId);
  if (!post) throw new Error("Post concurrent introuvable.");

  // 3) Vocabulaire existant (standardisation).
  let vocab = null;
  try {
    vocab = await getVocabulary();
  } catch {
    /* best-effort */
  }

  // 4) Générer l'analyse (OpenRouter).
  const userPrompt = buildAnalysisUserPrompt(JSON.stringify([post], null, 2), vocab);
  const aiData = await callOpenRouter(userPrompt);
  const rawContent = aiData?.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("Réponse vide du modèle.");

  const parsed = extractJson(rawContent);
  const result = parsed?.analyses?.[0];
  if (!result) throw new Error("Format de réponse inattendu.");

  // 5) Enregistrer l'analyse COMPLÈTE d'abord (posts_analyses, avec l'id du post).
  const interactions = post.total_interactions ?? (post.reactions || 0) + (post.comments || 0);
  await upsertPostAnalysis({
    ...result,
    post_id: post.id,
    post_url: post.url ?? null,
    concurrent_url: post.concurrent_url ?? null,
    metrics: {
      total_interactions: interactions,
      num_likes: post.reactions ?? 0,
      num_comments: post.comments ?? 0,
    },
  });

  // 6) Extraire les caractéristiques -> dimensions (dim_*).
  const dimensionErrors = await storeCharacteristics(result, post.id);

  return { success: true, skipped: false, analyzed: true, post_id: post.id, dimensionErrors };
}

/* ================================================================== */
/*  Analyse GLOBALE : tous les posts, un par un                        */
/* ================================================================== */

export async function analyseAllConcurrentPosts() {
  const posts = await findAllConcurrentPosts();

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const p of posts) {
    try {
      if (await analysisExists(p.id)) {
        skipped++;
        results.push({ post_id: p.id, skipped: true });
        continue;
      }
      const r = await analyseOnePost(p.id);
      if (r.analyzed) {
        analyzed++;
        results.push({ post_id: p.id, analyzed: true });
        await sleep(400); // ménage le rate-limit OpenRouter
      } else {
        skipped++;
        results.push({ post_id: p.id, skipped: true });
      }
    } catch (e) {
      failed++;
      results.push({ post_id: p.id, error: e.message });
    }
  }

  return { success: true, total: posts.length, analyzed, skipped, failed, results };
}

/* ================================================================== */
/*  Lecture des analyses                                               */
/* ================================================================== */

export async function getAllAnalyses() {
  return findAllPostAnalyses();
}

export async function getAnalysis(postId) {
  return findPostAnalysisByPostId(postId);
}