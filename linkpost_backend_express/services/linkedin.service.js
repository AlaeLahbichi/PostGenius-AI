import { brightDataConfig } from "../config/brightdata.js";

import {
    upsertManyPublications
} from "../repositories/publication.repository.js";

/**
 * Date utilisée lorsque l'utilisateur
 * ne fournit pas de date de début.
 *
 * Cela permet de demander les publications
 * depuis le début.
 */
const DEFAULT_START_DATE =
    "1970-01-01T00:00:00.000Z";

/**
 * Vérifie et transforme une date
 * en date ISO.
 */
function normalizeDate(
    dateValue,
    defaultValue
) {

    if (
        dateValue === null ||
        dateValue === undefined ||
        dateValue === ""
    ) {

        return defaultValue;

    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {

        throw new Error(
            `Date invalide : ${dateValue}`
        );

    }

    return date.toISOString();

}

/**
 * Transforme une valeur en nombre.
 */
function toNumber(value) {

    const number = Number(value);

    if (Number.isNaN(number)) {

        return 0;

    }

    return number;

}

/**
 * Calcule le nombre total d'interactions
 * d'une publication.
 *
 * Plusieurs noms de champs sont pris en charge
 * car le format peut varier selon la réponse
 * retournée par Bright Data.
 */
function calculateTotalInteractions(post) {

    const reactions = toNumber(

        post.reactions_count ??
        post.reaction_count ??
        post.likes_count ??
        post.like_count ??
        post.num_likes ??
        post.total_reactions ??
        post.likes ??
        0

    );

    const comments = toNumber(

        post.comments_count ??
        post.comment_count ??
        post.num_comments ??
        post.total_comments ??
        post.comments ??
        0

    );

    const shares = toNumber(

        post.shares_count ??
        post.share_count ??
        post.reposts_count ??
        post.repost_count ??
        post.num_shares ??
        post.total_shares ??
        post.shares ??
        0

    );

    return reactions + comments + shares;

}

/**
 * Vérifie la valeur de count.
 *
 * null, undefined ou chaîne vide :
 * toutes les publications sont retournées.
 */
function normalizeCount(count) {

    if (
        count === null ||
        count === undefined ||
        count === ""
    ) {

        return null;

    }

    const parsedCount = Number(count);

    if (
        !Number.isInteger(parsedCount) ||
        parsedCount <= 0
    ) {

        throw new Error(
            "count doit être un entier supérieur à 0 ou null."
        );

    }

    return parsedCount;

}

/**
 * Extrait les publications présentes
 * dans la réponse Bright Data.
 */
function extractPostsFromResponse(data) {

    if (Array.isArray(data)) {

        return data;

    }

    if (Array.isArray(data.data)) {

        return data.data;

    }

    if (Array.isArray(data.posts)) {

        return data.posts;

    }

    if (Array.isArray(data.results)) {

        return data.results;

    }

    return [];

}

/**
 * Fonction interne permettant de récupérer
 * les publications depuis Bright Data.
 *
 * Les dates sont facultatives.
 */
async function fetchPostsFromBrightData(
    profileUrl,
    {
        startDate = null,
        endDate = null
    } = {}
) {

    if (!brightDataConfig.apiKey) {

        throw new Error(
            "BRIGHT_DATA_API_KEY est absente."
        );

    }

    if (
        !profileUrl ||
        typeof profileUrl !== "string"
    ) {

        throw new Error(
            "profileUrl est obligatoire."
        );

    }

    const normalizedStartDate = normalizeDate(

        startDate,

        DEFAULT_START_DATE

    );

    const normalizedEndDate = normalizeDate(

        endDate,

        new Date().toISOString()

    );

    if (
        new Date(normalizedStartDate).getTime() >
        new Date(normalizedEndDate).getTime()
    ) {

        throw new Error(
            "La date de début doit être inférieure ou égale à la date de fin."
        );

    }

    const body = {

        input: [

            {

                url: profileUrl,

                start_date:
                    normalizedStartDate,

                end_date:
                    normalizedEndDate,

                only_authored_posts: true

            }

        ]

    };

    const response = await fetch(

        brightDataConfig.apiUrl,

        {

            method: "POST",

            headers: {

                Authorization:
                    `Bearer ${brightDataConfig.apiKey}`,

                ...brightDataConfig.defaultHeaders

            },

            body: JSON.stringify(body)

        }

    );

    const text = await response.text();

    let data;

    try {

        data = JSON.parse(text);

    }

    catch {

        throw new Error(
            "Bright Data n'a pas retourné un JSON valide."
        );

    }

    if (!response.ok) {

        throw new Error(

            `Bright Data : ${response.status}\n\n${JSON.stringify(data)}`

        );

    }

    /**
     * Bright Data peut retourner un snapshot_id
     * lorsque la collecte est asynchrone.
     */
    if (data.snapshot_id) {

        return {

            async: true,

            snapshot_id:
                data.snapshot_id,

            startDate:
                normalizedStartDate,

            endDate:
                normalizedEndDate

        };

    }

    const posts =
        extractPostsFromResponse(data);

    return {

        async: false,

        posts,

        startDate:
            normalizedStartDate,

        endDate:
            normalizedEndDate

    };

}

/**
 * Fonction existante :
 * récupère les publications avec les dates
 * utilisées précédemment.
 */
async function fetchPosts(profileUrl) {

    return await fetchPostsFromBrightData(

        profileUrl,

        {

            startDate:
                "2020-01-01T00:00:00.000Z",

            endDate:
                new Date().toISOString()

        }

    );

}

/**
 * Synchronise un profil LinkedIn.
 *
 * Bright Data -> MongoDB
 */
export async function syncLinkedinPosts(profileUrl) {

    const result =
        await fetchPosts(profileUrl);

    if (result.async) {

        return {

            success: true,

            async: true,

            snapshot_id:
                result.snapshot_id,

            message:
                "La collecte est en cours."

        };

    }

    /**
     * Vérification et sauvegarde MongoDB.
     *
     * Si l'id existe :
     * mise à jour.
     *
     * Si l'id n'existe pas :
     * insertion.
     */
    const mongoResult =
        await upsertManyPublications(
            result.posts
        );

    return {

        success: true,

        async: false,

        profile:
            profileUrl,

        totalPosts:
            result.posts.length,

        inserted:
            mongoResult.inserted,

        updated:
            mongoResult.updated,

        posts:
            result.posts

    };

}

/**
 * Fonction existante :
 * lit directement les publications depuis
 * Bright Data sans les enregistrer.
 */
export async function getPosts(profileUrl) {

    const result =
        await fetchPosts(profileUrl);

    if (result.async) {

        throw new Error(
            "La récupération est asynchrone."
        );

    }

    return result.posts;

}

/**
 * Nouvelle fonction.
 *
 * Récupère les publications d'un profil
 * selon :
 *
 * - l'URL du profil ;
 * - une date de début facultative ;
 * - une date de fin facultative ;
 * - un count facultatif.
 *
 * Toutes les publications récupérées sont
 * enregistrées ou mises à jour dans MongoDB.
 *
 * Ensuite, elles sont triées par interactions
 * et limitées selon count.
 */
export async function getFilteredLinkedinPosts(
    profileUrl,
    {
        startDate = null,
        endDate = null,
        count = null
    } = {}
) {

    const normalizedCount =
        normalizeCount(count);

    const result =
        await fetchPostsFromBrightData(
            profileUrl,
            {
                startDate,
                endDate
            }
        );

    /**
     * Bright Data a lancé une collecte asynchrone.
     */
    if (result.async) {

        return {

            success: true,

            async: true,

            snapshot_id:
                result.snapshot_id,

            profile:
                profileUrl,

            filters: {

                startDate:
                    result.startDate,

                endDate:
                    result.endDate,

                count:
                    normalizedCount

            },

            message:
                "La collecte est en cours."

        };

    }

    /**
     * Ajoute le nombre total d'interactions
     * à chaque publication.
     *
     * Puis trie les publications de la plus
     * populaire à la moins populaire.
     */
    const sortedPosts =
        result.posts

            .map((post) => {

                return {

                    ...post,

                    total_interactions:
                        calculateTotalInteractions(post)

                };

            })

            .sort((postA, postB) => {

                return (
                    postB.total_interactions -
                    postA.total_interactions
                );

            });

    /**
     * Si count est null :
     * toutes les publications sont sélectionnées.
     *
     * Si count est renseigné :
     * seules les premières publications sont
     * sélectionnées.
     */
    const selectedPosts =

        normalizedCount === null

            ? sortedPosts

            : sortedPosts.slice(
                0,
                normalizedCount
            );

    /**
     * Enregistrer uniquement les publications
     * sélectionnées selon count.
     *
     * Le repository doit utiliser un upsert :
     *
     * - si la publication existe déjà :
     *   elle est mise à jour ;
     *
     * - si elle n'existe pas :
     *   elle est insérée.
     */
    const mongoResult =
        await upsertManyPublications(
            selectedPosts
        );

    return {

        success: true,

        async: false,

        profile:
            profileUrl,

        filters: {

            startDate:
                result.startDate,

            endDate:
                result.endDate,

            count:
                normalizedCount

        },

        database: {

            totalProcessed:
                mongoResult.total,

            inserted:
                mongoResult.inserted,

            updated:
                mongoResult.updated

        },

        /**
         * Nombre total de posts récupérés
         * depuis Bright Data.
         */
        totalFetched:
            result.posts.length,

        /**
         * Nombre de posts sélectionnés selon count.
         */
        totalSelected:
            selectedPosts.length,

        /**
         * Nombre de posts insérés ou mis à jour.
         */
        totalSaved:
            mongoResult.total,

        posts:
            selectedPosts

    };

}