import { getCollection } from "../config/mongodb.js";

const COLLECTION_NAME =
    "post_analyse";

/**
 * Retourne la collection post_analyse.
 */
async function collection() {

    const analyses =
        getCollection(
            COLLECTION_NAME
        );

    /**
     * Création automatique de l'index unique.
     *
     * Cela évite d'enregistrer deux analyses
     * pour le même post_id ; une nouvelle analyse
     * remplace l'ancienne (upsert).
     */
    await analyses.createIndex(

        {
            post_id: 1
        },

        {
            unique: true
        }

    );

    return analyses;

}

/**
 * Vérifie qu'une analyse possède
 * un post_id valide.
 */
function validateAnalysisPostId(
    analysis
) {

    if (
        !analysis ||
        analysis.post_id === null ||
        analysis.post_id === undefined ||
        analysis.post_id === ""
    ) {

        throw new Error(
            "Impossible d'enregistrer une analyse sans post_id."
        );

    }

}

/**
 * Insère ou met à jour l'analyse d'un post.
 *
 * Si post_id existe déjà :
 * mise à jour (l'ancienne analyse est remplacée).
 *
 * Sinon :
 * insertion.
 */
export async function upsertPostAnalysis(
    analysis
) {

    validateAnalysisPostId(
        analysis
    );

    const analyses =
        await collection();

    const result =
        await analyses.updateOne(

            {
                post_id:
                    analysis.post_id
            },

            {
                $set: {

                    ...analysis,

                    updated_at:
                        new Date()

                },

                $setOnInsert: {

                    created_at:
                        new Date()

                }
            },

            {
                upsert: true
            }

        );

    return {

        inserted:
            result.upsertedCount > 0,

        updated:
            result.matchedCount > 0,

        matchedCount:
            result.matchedCount,

        modifiedCount:
            result.modifiedCount,

        upsertedCount:
            result.upsertedCount,

        upsertedId:
            result.upsertedId ?? null

    };

}

/**
 * Retourne toutes les analyses.
 */
export async function findAllPostAnalyses() {

    const analyses =
        await collection();

    return await analyses
        .find()
        .sort({
            created_at: -1
        })
        .toArray();

}

/**
 * Recherche l'analyse d'un post
 * grâce à son post_id.
 */
export async function findPostAnalysisByPostId(
    postId
) {

    const analyses =
        await collection();

    return await analyses.findOne({

        post_id:
            postId

    });

}

/**
 * Supprime l'analyse d'un post.
 */
export async function deletePostAnalysis(
    postId
) {

    const analyses =
        await collection();

    return await analyses.deleteOne({

        post_id:
            postId

    });

}