import { getCollection } from "../config/mongodb.js";

const COLLECTION_NAME =
    "publications";

/**
 * Retourne la collection publications.
 */
async function collection() {

    const publications =
        getCollection(
            COLLECTION_NAME
        );

    /**
     * Création automatique de l'index unique.
     *
     * Cela évite d'enregistrer deux publications
     * possédant le même identifiant LinkedIn.
     */
    await publications.createIndex(

        {
            id: 1
        },

        {
            unique: true
        }

    );

    return publications;

}

/**
 * Vérifie qu'une publication possède
 * un identifiant valide.
 */
function validatePublicationId(
    publication
) {

    if (
        !publication ||
        publication.id === null ||
        publication.id === undefined ||
        publication.id === ""
    ) {

        throw new Error(
            "Impossible d'enregistrer une publication sans id."
        );

    }

}

/**
 * Insère ou met à jour une publication.
 *
 * Si publication.id existe déjà :
 * mise à jour.
 *
 * Sinon :
 * insertion.
 */
export async function upsertPublication(
    publication
) {

    validatePublicationId(
        publication
    );

    const publications =
        await collection();

    const result =
        await publications.updateOne(

            {
                id:
                    publication.id
            },

            {
                $set:
                    publication,

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
 * Insère ou met à jour plusieurs publications.
 *
 * Pour chaque publication :
 *
 * - si l'id existe, les données sont mises à jour ;
 * - si l'id n'existe pas, la publication est créée.
 */
export async function upsertManyPublications(
    publicationsList
) {

    if (!Array.isArray(publicationsList)) {

        throw new Error(
            "publicationsList doit être un tableau."
        );

    }

    if (publicationsList.length === 0) {

        return {

            total: 0,

            inserted: 0,

            updated: 0,

            modified: 0,

            unchanged: 0,

            errors: []

        };

    }

    const publications =
        await collection();

    let inserted = 0;

    let updated = 0;

    let modified = 0;

    let unchanged = 0;

    const errors = [];

    for (
        const publication
        of publicationsList
    ) {

        try {

            validatePublicationId(
                publication
            );

            const result =
                await publications.updateOne(

                    {
                        id:
                            publication.id
                    },

                    {
                        $set: {

                            ...publication,

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

            /**
             * Le document n'existait pas :
             * MongoDB l'a inséré.
             */
            if (
                result.upsertedCount > 0
            ) {

                inserted++;

                continue;

            }

            /**
             * Le document existait déjà.
             */
            if (
                result.matchedCount > 0
            ) {

                updated++;

                if (
                    result.modifiedCount > 0
                ) {

                    modified++;

                } else {

                    unchanged++;

                }

            }

        }

        catch (error) {

            errors.push({

                publicationId:
                    publication?.id ?? null,

                message:
                    error.message

            });

        }

    }

    return {

        total:
            publicationsList.length,

        inserted,

        updated,

        modified,

        unchanged,

        errors

    };

}

/**
 * Retourne toutes les publications.
 */
export async function findAllPublications() {

    const publications =
        await collection();

    return await publications
        .find()
        .sort({
            date_posted: -1
        })
        .toArray();

}

/**
 * Recherche une publication par son id LinkedIn.
 */
export async function findPublicationById(
    id
) {

    const publications =
        await collection();

    return await publications.findOne({

        id

    });

}

/**
 * Recherche toutes les publications
 * d'un utilisateur.
 */
export async function findPublicationsByUser(
    userId
) {

    const publications =
        await collection();

    return await publications
        .find({

            user_id:
                userId

        })
        .toArray();

}

/**
 * Recherche toutes les publications
 * d'un profil.
 */
export async function findPublicationsByProfile(
    profileUrl
) {

    const publications =
        await collection();

    return await publications
        .find({

            "discovery_input.url":
                profileUrl

        })
        .toArray();

}

/**
 * Recherche une publication grâce à son URL.
 */
export async function findPublicationByUrl(
    url
) {

    const publications =
        await collection();

    return await publications.findOne({

        url

    });

}

/**
 * Supprime une publication.
 */
export async function deletePublication(
    id
) {

    const publications =
        await collection();

    return await publications.deleteOne({

        id

    });

}

/**
 * Supprime toutes les publications.
 */
export async function deleteAllPublications() {

    const publications =
        await collection();

    return await publications.deleteMany(
        {}
    );

}

/**
 * Nombre total de publications.
 */
export async function countPublications() {

    const publications =
        await collection();

    return await publications.countDocuments();

}

/**
 * Vérifie si une publication existe.
 */
export async function publicationExists(
    id
) {

    const publications =
        await collection();

    const count =
        await publications.countDocuments({

            id

        });

    return count > 0;

}