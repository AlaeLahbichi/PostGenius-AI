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
    removePostAnalysis,
    getAnalysisVocabulary,
    getAnalysisInsights
} from "../controllers/postAnalyse.controller.js";

const router = Router();

router.post(
    "/posts/sync",
    syncPosts
);


router.post(
    "/posts",
    fetchPosts
);

router.post(
    "/posts/filter",
    fetchFilteredPosts
);


router.get(
    "/posts",
    getAllPosts
);


router.get(
    "/posts/:id",
    getPostById
);

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


router.get(
    "/analysis/vocabulary",
    getAnalysisVocabulary
);

router.get(
    "/analysis/insights",
    getAnalysisInsights
);


router.get(
    "/get_post_analysis/:postId",
    getPostAnalysis
);


router.delete(
    "/get_post_analysis_delete/:postId",
    removePostAnalysis
);

export default router;