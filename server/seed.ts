import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

async function seed() {
    try {
        const schema = fs.readFileSync(path.join(process.cwd(), 'server', 'schema.sql'), 'utf-8');
        
        // Remove USE overheat to avoid issues if we connect to it initially
        const queries = schema
            .replace(/USE overheat;/g, '')
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);

        const conn = await pool.getConnection();

        // Create DB and USE
        await conn.query('CREATE DATABASE IF NOT EXISTS overheat;');
        await conn.query('USE overheat;');
        
        for (const query of queries) {
            // Ignore CREATE DATABASE IF NOT EXISTS overheat again
            if (query.includes('CREATE DATABASE')) continue;
            // console.log(`Executing: ${query.substring(0, 50)}...`);
            await conn.query(query);
        }
        
        // console.log('Schema setup complete');
        conn.release();
        process.exit(0);
    } catch (err) {
        console.error('Seed errors:', err);
        process.exit(1);
    }
}

seed();
