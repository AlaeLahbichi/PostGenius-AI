import {
  GEN_DIMS,
  listValues,
  getValueDoc,
  getPostsByIds,
  insertCreatedPost,
  listCreatedPosts,
} from "../repositories/generate.repository.js";

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

    if (aiRes.status !== 429) throw new Error(`OpenRouter a répondu ${aiRes.status}.`);
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

const RECO_SYSTEM = `Tu es un stratège éditorial LinkedIn. On te donne l'objectif d'un post et une liste de valeurs candidates pour une caractéristique éditoriale (pattern, hook, angle, style, ton ou format). Sélectionne les 2 valeurs les PLUS pertinentes pour atteindre cet objectif. Choisis UNIQUEMENT parmi la liste fournie, en recopiant le libellé exact. Réponds UNIQUEMENT en JSON, sans texte ni Markdown : {"recommendations":[{"value":"...","reason":"1 phrase courte"},{"value":"...","reason":"1 phrase courte"}]}`;

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

const GEN_SYSTEM = `Tu es un ghostwriter LinkedIn senior et stratège de contenu B2B francophone. Tu écris des publications LinkedIn originales, crédibles et engageantes, calibrées pour la portée et l'interaction, sans jamais tomber dans le "post IA" générique.

Principes de rédaction :
- Français, première personne, ton humain et incarné.
- Première ligne = accroche (hook) qui donne envie de cliquer "voir plus", sans clickbait mensonger.
- Idées aérées : phrases courtes, sauts de ligne fréquents, une idée par ligne ou paragraphe.
- Tu appliques RIGOUREUSEMENT les caractéristiques imposées (pattern, hook, angle, styles, tons, format).
- Les exemples fournis servent UNIQUEMENT d'inspiration de registre, de structure et de rythme : tu ne copies JAMAIS une phrase, un chiffre, un nom propre ou une tournure spécifique.
- Tu intègres des @mentions pertinentes et plausibles quand c'est naturel (personnes/entreprises), sans inventer de fausses citations ni de faux chiffres.
- Zéro superlatif creux, zéro buzzword vide, 0 à 3 emojis maximum (seulement s'ils servent le propos).
- Si une intention (call to action) est fournie, tu termines par un appel à l'action clair et non racoleur.
- Longueur adaptée à LinkedIn et à la longueur demandée.

Sortie : UNIQUEMENT un objet JSON valide, sans texte ni Markdown autour :
{"post_text":"<le post complet, prêt à publier, avec des sauts de ligne \\n et les @mentions inline>","hashtags":["#..."],"mentions":["@..."]}`;

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
    .map((e) => ({ ...e, text: e.text.slice(0, 600) }));

  return { chosen, examples, relatedCount: allIds.length };
}

export async function generatePost(selections) {
  const objective = String(selections.objective || "").trim();
  if (!objective) throw new Error("L'objectif du post est obligatoire.");

  const { chosen, examples, relatedCount } = await gatherExamples(selections);

  const criteriaBlock = chosen.map((c) => `- ${c.label}`).join("\n") || "- (aucune caractéristique choisie)";
  const examplesBlock =
    examples.length > 0
      ? examples
          .map((e, i) => `Exemple ${i + 1} [${e.matched.join(", ")}] — ${e.interactions} interactions :\n"""${e.text}"""`)
          .join("\n\n")
      : "Aucun exemple disponible.";

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

  return { success: true, post_text, hashtags, mentions, relatedCount, examplesUsed: examples.length };
}

/* ================================================================== */
/*  Sauvegarde (brouillon / partagé)                                  */
/* ================================================================== */

export async function savePost(payload) {
  const status = payload.status === "shared" ? "shared" : "brouillon";
  const post_text = String(payload.post_text ?? "").trim();
  if (!post_text) throw new Error("Le texte du post est vide.");

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
  };

  const id = await insertCreatedPost(doc);
  return { success: true, id, status };
}

export async function getCreated() {
  return listCreatedPosts();
}