import { getCollection } from "../config/mongodb.js";

/**
 * Repository générique pour les collections de dimensions normalisées
 * (dim_hooks, dim_patterns, dim_styles, dim_tones, dim_angles, dim_tools,
 *  dim_formats, dim_types, dim_structures, dim_keywords).
 *
 * Chaque document représente UNE valeur unique :
 * {
 *   slug: "preuve-par-innovation",   // clé canonique (dédoublonnage)
 *   value: "Preuve par l'innovation",// libellé d'affichage (1re occurrence)
 *   usage_count: 3,                  // nombre de posts DISTINCTS
 *   post_ids: ["urn:li:...", ...],   // clés étrangères (dédoublonnées)
 *   created_at, updated_at
 * }
 */

async function collection(name) {
  const col = getCollection(name);
  await col.createIndex({ slug: 1 }, { unique: true });
  return col;
}

/**
 * Ajoute (idempotent) un post à une valeur de dimension.
 *
 * - $setUnion dédoublonne les post_ids : un même post analysé deux fois
 *   ne compte qu'une seule fois ;
 * - usage_count est recalculé = nombre de posts distincts.
 */
export async function applyValue(collectionName, { value, slug }, postId) {
  const col = await collection(collectionName);

  await col.updateOne(
    { slug },
    [
      {
        $set: {
          slug: slug,
          // On garde le premier libellé rencontré comme affichage.
          value: { $ifNull: ["$value", value] },
          post_ids: { $setUnion: [{ $ifNull: ["$post_ids", []] }, [postId]] },
          created_at: { $ifNull: ["$created_at", "$$NOW"] },
          updated_at: "$$NOW",
        },
      },
      { $set: { usage_count: { $size: "$post_ids" } } },
    ],
    { upsert: true }
  );
}

/**
 * Retire un post d'une valeur de dimension.
 *
 * Utile lorsqu'une ré-analyse change la valeur, ou lors d'une suppression.
 * Si plus aucun post n'utilise la valeur, le document est supprimé.
 */
export async function retractValue(collectionName, slug, postId) {
  const col = await collection(collectionName);

  await col.updateOne({ slug }, [
    {
      $set: {
        post_ids: {
          $filter: {
            input: { $ifNull: ["$post_ids", []] },
            cond: { $ne: ["$$this", postId] },
          },
        },
        updated_at: "$$NOW",
      },
    },
    { $set: { usage_count: { $size: "$post_ids" } } },
  ]);

  await col.deleteOne({ slug, usage_count: 0 });
}

/**
 * Valeurs d'une dimension triées par usage décroissant.
 */
export async function listValues(collectionName, limit = 100) {
  const col = await collection(collectionName);
  return await col
    .find()
    .sort({ usage_count: -1, value: 1 })
    .limit(limit)
    .toArray();
}