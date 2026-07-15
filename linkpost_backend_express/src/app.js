import express from "express";
import cors from "cors";
import morgan from "morgan";

import linkedinRoutes from "../routes/linkedin.routes.js";

const app = express();

/**
 * ===============================
 * Middlewares
 * ===============================
 */

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(morgan("dev"));

/**
 * ===============================
 * Route de test
 * ===============================
 */

app.get("/", (req, res) => {

    res.json({

        success: true,

        application: "PostGenius AI",

        version: "1.0.0",

        status: "running"

    });

});

/**
 * ===============================
 * Routes API
 * ===============================
 */

app.use("/linkedin", linkedinRoutes);

/**
 * ===============================
 * Route inexistante
 * ===============================
 */

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message: "Route introuvable."

    });

});

/**
 * ===============================
 * Gestion globale des erreurs
 * ===============================
 */

app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({

        success: false,

        message: err.message || "Erreur interne du serveur."

    });

});

export default app;