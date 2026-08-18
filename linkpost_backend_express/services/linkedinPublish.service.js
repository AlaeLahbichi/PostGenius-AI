/**
 * Publication réelle d'un poste sur LinkedIn (au nom du compte
 * propriétaire du token, mono-utilisateur).
 *
 * Nécessite dans .env :
 * - LINKEDIN_ACCESS_TOKEN : token OAuth avec le scope w_member_social
 *   (généré via le Token Generator du Developer Portal LinkedIn).
 * - LINKEDIN_AUTHOR_URN (optionnel) : "urn:li:person:XXXXXXXX".
 *   Si absent, on tente de le déduire automatiquement via /v2/userinfo,
 *   ce qui exige en plus le scope "profile"/"openid" sur le token.
 *   Sans l'un des deux, la publication est impossible (LinkedIn exige
 *   un auteur explicite — aucun moyen de le deviner autrement).
 * - LINKEDIN_TOKEN_ISSUED_AT (recommandé) : date (AAAA-MM-JJ) de génération
 *   du token, pour estimer son expiration (voir getTokenStatus ci-dessous).
 */

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_REST_BASE = "https://api.linkedin.com/rest";

// Version des API REST versionnées LinkedIn (obligatoire sur /rest/*,
// header "LinkedIn-Version"). LinkedIn ne garde qu'une fenêtre glissante
// de versions actives (~12 mois) : si cette valeur finit par être trop
// ancienne, LinkedIn répond 426 "NONEXISTENT_VERSION" — dans ce cas,
// relever LINKEDIN_API_VERSION dans .env avec une version plus récente
// (format AAAAMM, voir la doc LinkedIn "API Versioning").
const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || "202503";

let cachedAuthorUrn = null;

function getAccessToken() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINKEDIN_ACCESS_TOKEN manquant dans .env.");
  }
  return token;
}

/**
 * Résout l'URN de l'auteur (urn:li:person:...).
 * Priorité à LINKEDIN_AUTHOR_URN (pas besoin de scope profil),
 * sinon tentative via /v2/userinfo (scope "profile"/"openid" requis).
 */
async function getAuthorUrn() {
  if (cachedAuthorUrn) return cachedAuthorUrn;

  const configured = process.env.LINKEDIN_AUTHOR_URN;
  if (configured) {
    cachedAuthorUrn = configured;
    return cachedAuthorUrn;
  }

  const token = getAccessToken();
  const res = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.sub) {
    throw new Error(
      "Impossible de déterminer l'auteur LinkedIn. Ajoute LINKEDIN_AUTHOR_URN=\"urn:li:person:TON_ID\" " +
        "dans .env, ou régénère le token en cochant aussi le scope \"profile\"/\"openid\" " +
        `(détail LinkedIn : ${data.message || res.status}).`
    );
  }

  cachedAuthorUrn = `urn:li:person:${data.sub}`;
  return cachedAuthorUrn;
}

/**
 * LinkedIn n'a pas de champ hashtags dédié : ils font partie du texte.
 */
export function buildShareText(postText, hashtags) {
  const text = String(postText || "").trim();
  const tags = (hashtags || [])
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  return tags ? `${text}\n\n${tags}` : text;
}

/**
 * Envoie une image à LinkedIn via l'API REST Images (successeur de
 * l'ancienne Assets API "/v2/assets" + "/v2/ugcPosts", qui pouvait
 * répondre 200 sans jamais réellement publier le post avec son image —
 * un problème connu de cette ancienne API). Deux appels : initializeUpload
 * (obtient une URL d'upload à usage unique), puis PUT du binaire.
 * Retourne l'urn "urn:li:image:..." prêt à référencer dans /rest/posts.
 */
export async function uploadImage(imageBuffer) {
  const token = getAccessToken();
  const authorUrn = await getAuthorUrn();

  const initRes = await fetch(`${LINKEDIN_REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    throw new Error(
      `LinkedIn a refusé l'initialisation de l'upload d'image (${initRes.status}) : ${initData.message || JSON.stringify(initData)}`
    );
  }

  const uploadUrl = initData.value?.uploadUrl;
  const image = initData.value?.image;
  if (!uploadUrl || !image) {
    throw new Error("Réponse LinkedIn inattendue lors de l'initialisation de l'upload d'image.");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: imageBuffer,
  });
  if (!uploadRes.ok) {
    const uploadDetail = await uploadRes.text().catch(() => "");
    throw new Error(
      `Envoi de l'image à LinkedIn échoué (${uploadRes.status})${uploadDetail ? ` : ${uploadDetail.slice(0, 300)}` : ""}.`
    );
  }

  await waitForImageReady(image, token);
  return image;
}

/**
 * LinkedIn traite l'image de façon asynchrone après l'upload. On attend
 * qu'elle passe à "AVAILABLE" avant de la référencer dans /rest/posts —
 * et surtout, on échoue explicitement si LinkedIn signale
 * "PROCESSING_FAILED" (ex. image trop petite/corrompue), plutôt que de
 * laisser passer une publication qui ne montrera jamais l'image.
 */
async function waitForImageReady(imageUrn, token, { attempts = 8, delayMs = 1000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(`${LINKEDIN_REST_BASE}/images/${encodeURIComponent(imageUrn)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": LINKEDIN_API_VERSION,
      },
    });
    const data = await res.json().catch(() => ({}));
    const status = data?.status ?? null;

    if (status === "AVAILABLE") return;
    if (status === "PROCESSING_FAILED") {
      // Cause confirmée en pratique : une résolution trop élevée (testé :
      // 6250×6250 échoue, 2500×2500 passe). Le frontend redimensionne
      // déjà les images avant envoi (voir resizeImageIfNeeded côté
      // create/page.tsx) — ce cas ne devrait plus survenir que si l'image
      // vient d'ailleurs (API appelée directement, etc.).
      throw new Error(
        "LinkedIn n'a pas réussi à traiter l'image envoyée (statut PROCESSING_FAILED) — " +
          "généralement causé par une résolution trop élevée. Réessaie avec une image plus petite (max ~2500px de côté)."
      );
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("L'image envoyée à LinkedIn n'est toujours pas prête après plusieurs secondes d'attente.");
}

// LinkedIn limite le nombre d'images sur une seule publication. On
// s'aligne dessus côté appli (validé aussi à la sauvegarde, voir
// generate.service.js) pour échouer tôt avec un message clair plutôt
// que de laisser LinkedIn refuser la publication en fin de parcours.
export const MAX_IMAGES_PER_POST = 10;

/**
 * Publie un post AVEC une ou plusieurs images via la nouvelle API REST
 * (/rest/posts + /rest/images) — l'ancienne combinaison "/v2/assets" +
 * "/v2/ugcPosts" pouvait répondre 200 sans jamais réellement publier
 * l'image (post "fantôme", jamais visible sur le profil malgré le succès
 * apparent). Une seule image -> content.media ; plusieurs -> content.
 * multiImage (carrousel), dans l'ordre fourni.
 */
async function publishWithImages({ text, images }) {
  const token = getAccessToken();
  const authorUrn = await getAuthorUrn();

  // Upload séquentiel : plus lent que du parallèle, mais évite de
  // bombarder l'API LinkedIn de N requêtes simultanées pour un post à
  // 10 images, et rend un échec sur l'une d'elles simple à situer.
  const uploaded = [];
  for (const img of images) {
    const urn = await uploadImage(Buffer.from(img.base64, "base64"));
    uploaded.push(urn);
  }

  const content =
    uploaded.length === 1
      ? { media: { id: uploaded[0] } }
      : { multiImage: { images: uploaded.map((id) => ({ id })) } };

  const res = await fetch(`${LINKEDIN_REST_BASE}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content,
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  const linkedinPostId = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `LinkedIn a refusé la publication avec image (${res.status}) : ${data.message || JSON.stringify(data)}`
    );
  }

  return { linkedinPostId: linkedinPostId || data.id || null };
}

/**
 * Publie un post texte seul via l'API historique "/v2/ugcPosts" —
 * inchangée volontairement : ce chemin est fiable et déjà éprouvé, on ne
 * migre que le chemin avec image (voir publishWithImage) vers la
 * nouvelle API.
 */
async function publishTextOnly({ text }) {
  const token = getAccessToken();
  const authorUrn = await getAuthorUrn();

  const res = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  const linkedinPostId = res.headers.get("x-restli-id");
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `LinkedIn a refusé la publication (${res.status}) : ${data.message || JSON.stringify(data)}`
    );
  }

  return { linkedinPostId: linkedinPostId || data.id || null };
}

/**
 * Publie un poste sur LinkedIn (visibilité publique), texte seul ou avec
 * une ou plusieurs images jointes (`images`: [{ base64, mime_type }],
 * base64 sans le préfixe "data:...;base64,", jusqu'à MAX_IMAGES_PER_POST).
 * Retourne l'id du poste créé (utile pour lien direct plus tard).
 */
export async function publishToLinkedIn({ post_text, hashtags, images }) {
  const text = buildShareText(post_text, hashtags);
  if (!text) throw new Error("Le texte du post est vide, impossible de publier.");

  const list = (images || []).filter((img) => img?.base64);
  if (list.length > MAX_IMAGES_PER_POST) {
    throw new Error(`Trop d'images jointes (${list.length}) — ${MAX_IMAGES_PER_POST} maximum par post.`);
  }

  return list.length > 0 ? publishWithImages({ text, images: list }) : publishTextOnly({ text });
}

/* ================================================================== */
/*  Statut du token (durée de vie estimée)                             */
/* ================================================================== */

// Durée de vie standard d'un token membre LinkedIn (3-legged, obtenu via
// le Token Generator) : 60 jours. LinkedIn ne permet pas d'introspecter
// un token sans le client_secret de l'app — cette estimation est donc
// basée sur LINKEDIN_TOKEN_ISSUED_AT (à renseigner dans .env à la date de
// génération du token), pas sur une valeur lue depuis LinkedIn.
const TOKEN_LIFETIME_DAYS = 60;

export function getTokenStatus() {
  const hasToken = Boolean(process.env.LINKEDIN_ACCESS_TOKEN);
  const issuedAtRaw = process.env.LINKEDIN_TOKEN_ISSUED_AT;

  if (!hasToken || !issuedAtRaw) {
    return { hasToken, issuedAt: null, expiresAt: null, daysRemaining: null };
  }

  const issuedAt = new Date(issuedAtRaw);
  if (Number.isNaN(issuedAt.getTime())) {
    return { hasToken, issuedAt: null, expiresAt: null, daysRemaining: null };
  }

  const expiresAt = new Date(issuedAt.getTime() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return {
    hasToken,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
  };
}
