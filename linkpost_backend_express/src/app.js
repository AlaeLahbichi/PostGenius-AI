import express from "express";
import cors from "cors";
import morgan from "morgan";

import linkedinRoutes from "../routes/linkedin.routes.js";
import ownpostRoutes from "../routes/ownpost.routes.js";
import concurrentRoutes from "../routes/concurrent.routes.js";
import analyseConcurrentRoutes from "../routes/analyse_concurrent.routes.js";
import keyRoutes from "../routes/key.routes.js";
import generateRoutes from "../routes/generate.routes.js";

const app = express();


app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(morgan("dev"));


app.get("/", (req, res) => {

    res.json({

        success: true,

        application: "PostGenius AI",

        version: "1.0.0",

        status: "running"

    });

});


app.use("/linkedin", linkedinRoutes);

app.use("/ownposts", ownpostRoutes);

app.use("/concurrents", concurrentRoutes);

app.use("/analyse-concurrent", analyseConcurrentRoutes);

app.use("/keys", keyRoutes);

app.use("/generate", generateRoutes);


app.use((req, res) => {

    res.status(404).json({

        success: false,

        message: "Route introuvable."

    });

});


app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({

        success: false,

        message: err.message || "Erreur interne du serveur."

    });

});

export default app;