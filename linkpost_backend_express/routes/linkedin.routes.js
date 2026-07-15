import { Router } from "express";

import {
    syncPosts,
    fetchPosts,
    fetchFilteredPosts,
    getAllPosts,
    getPostById,
    removePost
} from "../controllers/linkedin.controller.js";

import {
    savePostAnalysis,
    getAllPostAnalyses,
    getPostAnalysis,
    removePostAnalysis
} from "../controllers/postAnalyse.controller.js";

const router = Router();

/**
 * Synchroniser un profil LinkedIn.
 *
 * Bright Data -> MongoDB
 *
 * POST /linkedin/posts/sync
 */
router.post(
    "/posts/sync",
    syncPosts
);

/**
 * Lire directement les publications
 * depuis Bright Data.
 *
 * Cette route existante ne les sauvegarde pas.
 *
 * POST /linkedin/posts
 */
router.post(
    "/posts",
    fetchPosts
);

/**
 * Nouvelle route.
 *
 * Lire les publications d'un profil
 * selon :
 *
 * - une date de début ;
 * - une date de fin ;
 * - un nombre maximum ;
 * - le nombre d'interactions.
 *
 * Les publications sont automatiquement
 * ajoutées ou mises à jour dans MongoDB.
 *
 * POST /linkedin/posts/filter
 */
router.post(
    "/posts/filter",
    fetchFilteredPosts
);

/**
 * Retourner toutes les publications
 * enregistrées dans MongoDB.
 *
 * GET /linkedin/posts
 */
router.get(
    "/posts",
    getAllPosts
);

/**
 * Retourner une publication.
 *
 * GET /linkedin/posts/:id
 */
router.get(
    "/posts/:id",
    getPostById
);

/**
 * Supprimer une publication.
 *
 * DELETE /linkedin/posts/:id
 */
router.delete(
    "/posts/:id",
    removePost
);

router.post(
    "/post-analyse",
    savePostAnalysis
);

router.get(
    "/get_all_post_analyses",
    getAllPostAnalyses
);

/**
 * Retourner l'analyse d'un post précis.
 *
 * GET /post-analyse/:postId
 */
router.get(
    "/get_post_analysis/:postId",
    getPostAnalysis
);

/**
 * Supprimer l'analyse d'un post.
 *
 * DELETE /post-analyse/:postId
 */
router.delete(
    "/get_post_analysis_delete/:postId",
    removePostAnalysis
);

export default router;