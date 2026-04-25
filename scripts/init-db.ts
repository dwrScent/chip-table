import { initDatabase } from "../lib/db";

const result = initDatabase();
console.log("Database initialized:", result.databasePath);
