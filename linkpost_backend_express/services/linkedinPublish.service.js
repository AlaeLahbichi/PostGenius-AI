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
 * Publie un poste texte sur LinkedIn (visibilité publique).
 * Retourne l'id du poste créé (utile pour lien direct plus tard).
 */
export async function publishToLinkedIn({ post_text, hashtags }) {
  const text = buildShareText(post_text, hashtags);
  if (!text) throw new Error("Le texte du post est vide, impossible de publier.");

  const authorUrn = await getAuthorUrn();
  const token = getAccessToken();

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
