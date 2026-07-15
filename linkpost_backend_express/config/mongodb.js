import { MongoClient } from "mongodb";

const MONGO_URI =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";

const DATABASE_NAME =
    process.env.MONGODB_DATABASE || "PostGenius_AI";

let client = null;
let database = null;

export async function connectMongo() {

    if (database) {
        return database;
    }

    try {

        client = new MongoClient(MONGO_URI);

        await client.connect();

        database = client.db(DATABASE_NAME);

        console.log("MongoDB connecté.");

        return database;

    } catch (error) {

        console.error("Erreur MongoDB :", error.message);

        process.exit(1);

    }

}

export function getDatabase() {

    if (!database) {

        throw new Error(
            "MongoDB n'est pas connecté. Appelez connectMongo() avant."
        );

    }

    return database;

}

export function getCollection(collectionName) {

    const db = getDatabase();

    return db.collection(collectionName);

}


export async function closeMongo() {

    if (client) {

        await client.close();

        console.log("MongoDB déconnecté.");

    }

}