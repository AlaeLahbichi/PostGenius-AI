import "dotenv/config";

import app from "./app.js";

import { connectMongo } from "../config/mongodb.js";
import { startPublishScheduler } from "../services/publishScheduler.service.js";

const PORT = process.env.PORT || 3000;

async function startServer() {

    try {

        console.log("");

        console.log("==============================");
        console.log("PostGenius AI");
        console.log("==============================");

        console.log("Connexion à MongoDB...");

        await connectMongo();

        console.log("MongoDB connecté.");

        console.log("");

        startPublishScheduler();

        app.listen(PORT, () => {

            console.log("==============================");

            console.log(`Serveur démarré sur le port ${PORT}`);

            console.log(`http://localhost:${PORT}`);

            console.log("==============================");

        });

    }

    catch (error) {

        console.error("");

        console.error("Impossible de démarrer le serveur.");

        console.error(error);

        process.exit(1);

    }

}

startServer();