import { pool } from './db';
import bcrypt from 'bcryptjs';

async function initDB() {
    console.log("Starting Database Initialization...");
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Create users table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                display_name VARCHAR(50) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                favorite_card_id VARCHAR(50) DEFAULT 'fav_card',
                created_at BIGINT
            )
        `);
        console.log("✅ Users table ensured");

        // 2. Create games table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS games (
                id VARCHAR(50) PRIMARY KEY,
                state JSON NOT NULL,
                status INT DEFAULT 0,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        console.log("✅ Games table ensured");

        // 3. Create decks table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS decks (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                cards JSON NOT NULL,
                is_favorite BOOLEAN DEFAULT FALSE,
                created_at BIGINT,
                updated_at BIGINT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Decks table ensured");

        // 4. Seed Users
        const accounts = [
            { id: 'admin', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
            { id: 'user_guest1', username: 'guest1', password: 'guest111', name: 'Test User 1', role: 'user' },
            { id: 'user_guest2', username: 'guest2', password: 'guest222', name: 'Test User 2', role: 'user' },
            { id: 'user_guest3', username: 'guest3', password: 'guest333', name: 'Test User 3', role: 'user' },
            { id: 'user_guest4', username: 'guest4', password: 'guest444', name: 'Test User 4', role: 'user' },
            { id: 'user_guest5', username: 'guest5', password: 'guest555', name: 'Test User 5', role: 'user' },
        ];

        for (const account of accounts) {
            // Check if user exists
            const existing = await conn.query('SELECT username FROM users WHERE username = ?', [account.username]);
            if (existing.length === 0) {
                const hash = await bcrypt.hash(account.password, 10);
                await conn.query(
                    'INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [account.id, account.username, hash, account.name, account.role, Date.now()]
                );
                console.log(`✅ Seeded user: ${account.username}`);
            } else {
                console.log(`⚠️ User ${account.username} already exists`);
            }
        }

        console.log("🚀 Database initialization complete!");
    } catch (err) {
        console.error("❌ Initialization error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

initDB();
