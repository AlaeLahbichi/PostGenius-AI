
import "dotenv/config";

const API_KEY = process.env.BRIGHT_DATA_API_KEY;

const PROFILE_URL =
  "https://www.linkedin.com/in/lahbichi-alae/";

const DATASET_ID = "gd_lyy3tktm25m4avu764";

const API_URL = new URL(
  "https://api.brightdata.com/datasets/v3/scrape"
);

API_URL.searchParams.set("dataset_id", DATASET_ID);
API_URL.searchParams.set("type", "discover_new");
API_URL.searchParams.set("discover_by", "profile_url");
API_URL.searchParams.set("format", "json");
API_URL.searchParams.set("include_errors", "true");

/**
 * Coupe un texte trop long pour garder une console lisible.
 */
function truncateText(text, maxLength = 350) {
  if (!text) {
    return "Non disponible";
  }

  const cleanText = text
    .replace(/\s+/g, " ")
    .trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength)}...`;
}

/**
 * Formate une date ISO en français.
 */
function formatDate(dateValue) {
  if (!dateValue) {
    return "Non disponible";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(date);
}

/**
 * Affiche un tableau récapitulatif des publications.
 */
function displayPostsTable(posts) {
  const summary = posts.map((post, index) => ({
    Nº: index + 1,
    Auteur: post.user_name ?? "Inconnu",
    Date: formatDate(post.date_posted),
    Likes: post.num_likes ?? 0,
    Commentaires: post.num_comments ?? 0,
    Images: Array.isArray(post.images)
      ? post.images.length
      : 0,
    Vidéos: Array.isArray(post.videos)
      ? post.videos.length
      : 0
  }));

  console.table(summary);
}

/**
 * Affiche le détail de chaque publication.
 */
function displayPostDetails(posts) {
  posts.forEach((post, index) => {
    const hashtags = Array.isArray(post.hashtags)
      ? post.hashtags.join(" ")
      : "Aucun hashtag";

    const imagesCount = Array.isArray(post.images)
      ? post.images.length
      : 0;

    const videosCount = Array.isArray(post.videos)
      ? post.videos.length
      : 0;

    const commentsCount = Array.isArray(
      post.top_visible_comments
    )
      ? post.top_visible_comments.length
      : 0;

    console.log(
      `\n${"=".repeat(70)}`
    );

    console.log(
      `PUBLICATION ${index + 1}/${posts.length}`
    );

    console.log(
      `${"=".repeat(70)}`
    );

    console.log(
      `Auteur          : ${post.user_name ?? "Non disponible"}`
    );

    console.log(
      `Identifiant     : ${post.user_id ?? "Non disponible"}`
    );

    console.log(
      `Date            : ${formatDate(post.date_posted)}`
    );

    console.log(
      `Titre           : ${post.headline ?? post.title ?? "Non disponible"}`
    );

    console.log(
      `Type            : ${post.post_type ?? "Non disponible"}`
    );

    console.log(
      `Likes           : ${post.num_likes ?? 0}`
    );

    console.log(
      `Commentaires    : ${post.num_comments ?? 0}`
    );

    console.log(
      `Commentaires lus: ${commentsCount}`
    );

    console.log(
      `Images          : ${imagesCount}`
    );

    console.log(
      `Vidéos          : ${videosCount}`
    );

    console.log(
      `Hashtags        : ${hashtags}`
    );

    console.log(
      `URL             : ${post.url ?? "Non disponible"}`
    );

    console.log("\nTexte :");

    console.log(
      truncateText(post.post_text, 500)
    );

    if (commentsCount > 0) {
      console.log("\nCommentaires visibles :");

      post.top_visible_comments
        .slice(0, 3)
        .forEach((comment, commentIndex) => {
          console.log(
            `  ${commentIndex + 1}. ${comment.user_name ?? "Utilisateur"} : ${truncateText(
              comment.comment,
              120
            )}`
          );
        });

      if (commentsCount > 3) {
        console.log(
          `  ... et ${commentsCount - 3} autre(s) commentaire(s) visible(s)`
        );
      }
    }
  });

  console.log(
    `\n${"=".repeat(70)}`
  );

  console.log(
    `Fin de l'affichage : ${posts.length} publication(s)`
  );

  console.log(
    `${"=".repeat(70)}\n`
  );
}

async function getLinkedInPosts() {
  if (!API_KEY) {
    throw new Error(
      "La variable BRIGHT_DATA_API_KEY est absente du fichier .env"
    );
  }

  const requestBody = {
    input: [
      {
        url: PROFILE_URL,
        start_date: "2020-01-01T00:00:00.000Z",
        end_date: new Date().toISOString(),

        // Bright Data doit retourner uniquement les publications
        // créées par le propriétaire du profil.
        only_authored_posts: true
      }
    ]
  };

  console.log("\nLinkedIn Posts Scraper");
  console.log("-".repeat(50));
  console.log(`Profil : ${PROFILE_URL}`);
  console.log("Récupération en cours...\n");

  const startTime = Date.now();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const rawResponse = await response.text();

  let data;

  try {
    data = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      `Bright Data n'a pas retourné du JSON valide.\n\n${rawResponse}`
    );
  }

  if (!response.ok) {
    console.error("\nErreur Bright Data :");
    console.dir(data, {
      depth: null,
      colors: true
    });

    throw new Error(
      `Requête échouée : HTTP ${response.status} ${response.statusText}`
    );
  }

  if (data?.snapshot_id) {
    console.log(
      "La collecte est exécutée en mode asynchrone."
    );

    console.log(
      `Snapshot ID : ${data.snapshot_id}`
    );

    return data;
  }

  const posts = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];

  const durationSeconds = (
    (Date.now() - startTime) /
    1000
  ).toFixed(2);

  console.log("Récupération terminée");
  console.log(`Durée : ${durationSeconds} seconde(s)`);
  console.log(
    `Nombre de publications : ${posts.length}\n`
  );

  if (posts.length === 0) {
    console.log(
      "Aucune publication publique n'a été trouvée."
    );

    return [];
  }

  console.log("RÉSUMÉ DES PUBLICATIONS\n");
  displayPostsTable(posts);

  console.log("\nDÉTAIL DES PUBLICATIONS");
  displayPostDetails(posts);

  return posts;
}

getLinkedInPosts().catch((error) => {
  console.error(
    "\nErreur pendant la récupération des publications :"
  );

  console.error(error.message);

  process.exitCode = 1;
});

