import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Construct connection strictly from environment variables to support Render
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('CRITICAL: No DATABASE_URL or NEON_DATABASE_URL provided. Exiting seed script.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Render/Neon remote DB connections
    connectionTimeoutMillis: 10000,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Reading seed.sql...');
        const sqlPath = path.join(__dirname, 'seed.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing idempotent seeding schema...');
        await client.query(sql);

        console.log('Database seeded successfully.');
        client.release();
    } catch (err) {
        console.error('Failed to seed database:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runSeed();
