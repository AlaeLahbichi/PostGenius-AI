import {
    syncLinkedinPosts,
    getPosts,
    getFilteredLinkedinPosts
} from "../services/linkedin.service.js";

import {
    findAllPublications,
    findPublicationById,
    deletePublication
} from "../repositories/publication.repository.js";


export async function syncPosts(req, res) {

    try {

        const { profileUrl } = req.body;

        if (!profileUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "profileUrl est obligatoire."

            });

        }

        const result =
            await syncLinkedinPosts(
                profileUrl
            );

        /**
         * Bright Data a démarré
         * une collecte asynchrone.
         */
        if (result.async) {

            return res.status(202).json(
                result
            );

        }

        return res.status(200).json(
            result
        );

    }

    catch (error) {

        console.error(
            "Erreur syncPosts :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}


export async function fetchPosts(req, res) {

    try {

        const { profileUrl } = req.body;

        if (!profileUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "profileUrl est obligatoire."

            });

        }

        const posts =
            await getPosts(profileUrl);

        return res.status(200).json({

            success: true,

            total:
                posts.length,

            posts

        });

    }

    catch (error) {

        console.error(
            "Erreur fetchPosts :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}


export async function fetchFilteredPosts(
    req,
    res
) {

    try {

        const {

            profileUrl,

            startDate = null,

            endDate = null,

            count = null

        } = req.body;

        /**
         * Seul profileUrl est obligatoire.
         */
        if (!profileUrl) {

            return res.status(400).json({

                success: false,

                message:
                    "profileUrl est obligatoire."

            });

        }

        const result =
            await getFilteredLinkedinPosts(

                profileUrl,

                {

                    startDate,

                    endDate,

                    count

                }

            );

      
        if (result.async) {

            return res.status(202).json(
                result
            );

        }

        return res.status(200).json(
            result
        );

    }

    catch (error) {

        console.error(
            "Erreur fetchFilteredPosts :",
            error
        );

        
        if (
            error.message.includes(
                "Date invalide"
            ) ||
            error.message.includes(
                "date de début"
            ) ||
            error.message.includes(
                "count doit"
            ) ||
            error.message.includes(
                "profileUrl"
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}


export async function getAllPosts(req, res) {

    try {

        const posts =
            await findAllPublications();

        return res.status(200).json({

            success: true,

            total:
                posts.length,

            posts

        });

    }

    catch (error) {

        console.error(
            "Erreur getAllPosts :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}


export async function getPostById(req, res) {

    try {

        const post =
            await findPublicationById(
                req.params.id
            );

        if (!post) {

            return res.status(404).json({

                success: false,

                message:
                    "Publication introuvable."

            });

        }

        return res.status(200).json({

            success: true,

            post

        });

    }

    catch (error) {

        console.error(
            "Erreur getPostById :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}


export async function removePost(req, res) {

    try {

        const result =
            await deletePublication(
                req.params.id
            );

        if (result.deletedCount === 0) {

            return res.status(404).json({

                success: false,

                deleted: 0,

                message:
                    "Publication introuvable."

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
            "Erreur removePost :",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

}