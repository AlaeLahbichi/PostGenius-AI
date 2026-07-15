const DATASET_ID = "gd_lyy3tktm25m4avu764";

const API_URL = new URL(
    "https://api.brightdata.com/datasets/v3/scrape"
);

API_URL.searchParams.set("dataset_id", DATASET_ID);
API_URL.searchParams.set("type", "discover_new");
API_URL.searchParams.set("discover_by", "profile_url");
API_URL.searchParams.set("format", "json");
API_URL.searchParams.set("include_errors", "true");

export const brightDataConfig = {

    apiKey: process.env.BRIGHT_DATA_API_KEY,

    datasetId: DATASET_ID,

    apiUrl: API_URL,

    defaultHeaders: {
        "Content-Type": "application/json"
    }

};