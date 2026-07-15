import {
    upsertPostAnalysis,
    findAllPostAnalyses,
    findPostAnalysisByPostId,
    deletePostAnalysis
} from "../repositories/postAnalyse.repository.js";

/**
 * Enregistrer l'analyse IA d'un post
 * (générée par le modèle via OpenRouter).
 *
 * Le body attendu correspond exactement à
 * la structure envoyée par le front :
 *
 * {
 *   "post_id": "...",
 *   "post_url": "...",
 *   "format": "...",
 *   "explication_format": "...",
 *   "type_post": "...",
 *   ...
 * }
 *
 * POST /post-analyse
 */
export async function savePostAnalysis(req, res) {

    try {

        const analysis = req.body;

        if (!analysis || !analysis.post_id) {

            return res.status(400).json({

                success: false,

                message:
                    "post_id est obligatoire."

            });

        }

        const result =
            await upsertPostAnalysis(
                analysis
            );

        return res.status(200).json({

            success: true,

            inserted:
                result.inserted,

            updated:
                result.updated

        });

    }

    catch (error) {

        console.error(
            "Erreur savePostAnalysis :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}

/**
 * Lire toutes les analyses enregistrées.
 *
 * GET /post-analyse
 */
export async function getAllPostAnalyses(req, res) {

    try {

        const analyses =
            await findAllPostAnalyses();

        return res.status(200).json({

            success: true,

            total:
                analyses.length,

            analyses

        });

    }

    catch (error) {

        console.error(
            "Erreur getAllPostAnalyses :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}

/**
 * Lire l'analyse d'un post précis.
 *
 * GET /post-analyse/:postId
 */
export async function getPostAnalysis(req, res) {

    try {

        const analysis =
            await findPostAnalysisByPostId(
                req.params.postId
            );

        if (!analysis) {

            return res.status(404).json({

                success: false,

                message:
                    "Analyse introuvable pour ce post."

            });

        }

        return res.status(200).json({

            success: true,

            analysis

        });

    }

    catch (error) {

        console.error(
            "Erreur getPostAnalysis :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}

/**
 * Supprimer l'analyse d'un post.
 *
 * DELETE /post-analyse/:postId
 */
export async function removePostAnalysis(req, res) {

    try {

        const result =
            await deletePostAnalysis(
                req.params.postId
            );

        if (result.deletedCount === 0) {

            return res.status(404).json({

                success: false,

                deleted: 0,

                message:
                    "Analyse introuvable."

            });

        }

        return res.status(200).json({

            success: true,

            deleted:
                result.deletedCount

        });

    }

    catch (error) {

        console.error(
            "Erreur removePostAnalysis :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}