/**
 * Seed des collections dim_* (taxonomie utilisée par la génération et
 * l'analyse de posts) avec un vocabulaire de départ.
 *
 * Sans ce seed, un vidage accidentel de la base laisse ces collections
 * vides : la génération et l'évaluation des dimensions ("Caractéristiques")
 * continuent de fonctionner (le vocabulaire se reconstruit au fil des
 * analyses), mais démarrent sans aucune valeur proposée tant qu'aucune
 * analyse n'a été relancée.
 *
 * Idempotent : chaque valeur n'est insérée que si son slug n'existe pas
 * déjà (`$setOnInsert`) — ne touche jamais aux compteurs d'usage réels
 * d'une valeur déjà utilisée.
 *
 * Usage : npm run seed:dimensions
 */
import "dotenv/config";
import { MongoClient } from "mongodb";

function canonical(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Vocabulaire de départ — repris des exemples donnés au modèle dans
 * ANALYSIS_SYSTEM_PROMPT (analyse_concurrent.service.js), pour rester
 * cohérent avec ce que l'IA est censée produire.
 *
 * dim_tools et dim_keywords ne sont pas seedées : ce sont des valeurs
 * ouvertes, propres à chaque post analysé (noms d'outils, mots-clés),
 * qu'il ne serait pas pertinent de pré-remplir.
 */
const SEED = {
  dim_types: [
    "EDUCATIF", "ACTUALITE_INSTITUTIONNELLE", "PROMOTIONNEL", "INSPIRANT",
    "STORYTELLING", "OPINION", "RETOUR_EXPERIENCE", "ETUDE_DE_CAS",
    "TUTORIEL", "LISTE", "ACTUALITE", "RECRUTEMENT", "EVENEMENT", "TEMOIGNAGE",
  ],
  dim_formats: ["TEXT", "IMAGE", "VIDEO", "CAROUSEL", "POLL", "DOCUMENT", "LINK"],
  dim_styles: [
    "professionnel", "institutionnel", "conversationnel", "pédagogique", "narratif",
    "provocateur", "analytique", "émotionnel", "humoristique", "valorisant",
    "direct", "concis", "détaillé", "authentique", "persuasif",
  ],
  dim_tones: [
    "éducatif", "fier", "célébratoire", "reconnaissant", "institutionnel",
    "provocateur", "inspirant", "critique", "rassurant", "enthousiaste",
    "empathique", "humoristique", "neutre", "autoritaire", "optimiste",
  ],
  dim_angles: [
    "Preuve par l'innovation", "Approche centrée utilisateur", "Démonstration par les résultats",
    "Résolution d'un problème concret", "Valorisation de l'expertise", "Retour d'expérience",
    "Pédagogie par l'exemple", "Remise en question", "Preuve sociale", "Projection vers le futur",
    "Comparaison stratégique", "Transformation avant-après", "Création d'urgence",
    "Storytelling personnel", "Leadership d'opinion", "Valorisation institutionnelle",
    "Démonstration par la preuve", "Sensibilisation par les conséquences",
  ],
  dim_hooks: [
    "Question provocante", "Statistique choc", "Anecdote personnelle", "Annonce",
    "Résultat chiffré", "Promesse", "Contradiction", "Citation",
    "Storytelling d'ouverture", "Constat sectoriel", "Erreur courante",
  ],
  dim_patterns: [
    "Situation – Action – Résultat", "Problème – Agitation – Solution",
    "Avant – Après – Pont", "Erreur – Leçon – Solution",
  ],
  dim_structures: [
    "hook", "contexte", "problème", "développement", "exemple", "liste",
    "preuve", "solution", "résultat", "conclusion", "appel à l'action", "remerciement",
  ],
};

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI et MONGODB_DATABASE doivent être définis (.env).");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  let inserted = 0;
  let alreadyPresent = 0;

  for (const [collectionName, values] of Object.entries(SEED)) {
    const col = db.collection(collectionName);
    await col.createIndex({ slug: 1 }, { unique: true });

    for (const value of values) {
      const slug = canonical(value);
      if (!slug) continue;

      const res = await col.updateOne(
        { slug },
        {
          $setOnInsert: {
            slug,
            value,
            post_ids: [],
            usage_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );

      if (res.upsertedCount > 0) inserted += 1;
      else alreadyPresent += 1;
    }

    console.log(`  ${collectionName} : OK`);
  }

  console.log(`\nSeed terminé : ${inserted} valeur(s) créée(s), ${alreadyPresent} déjà présente(s).`);
  await client.close();
}

main().catch((error) => {
  console.error("Erreur seed-dimensions :", error);
  process.exit(1);
});
