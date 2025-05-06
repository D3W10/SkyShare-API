import { Client } from "pg";

export function connectDB() {
    return new Client({
        connectionString: process.env.DATABASE_URL
    });
}