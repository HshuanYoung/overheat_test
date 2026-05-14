import { pool } from './db';

async function migrate() {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Add favorite_card_id, favorite_back_id, coins, and card_crystals to users if not exists
        try {
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_card_id VARCHAR(50) DEFAULT 'fav_card';`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_back_id VARCHAR(50) DEFAULT 'default';`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS coins BIGINT DEFAULT 100000;`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS card_crystals BIGINT DEFAULT 100000;`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;`);
            
            // Force update all users to have at least 100k
            await conn.query(`UPDATE users SET coins = 100000 WHERE coins < 100000 OR coins IS NULL;`);
            await conn.query(`UPDATE users SET card_crystals = 100000 WHERE card_crystals < 100000 OR card_crystals IS NULL;`);
            
            // console.log("✅ User columns and balances synchronized");
        } catch (e: any) {
            // console.log('Column add/update error:', e.message);
        }

        // 2. Create decks table
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
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS email_verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                code VARCHAR(6) NOT NULL,
                expires_at BIGINT NOT NULL,
                created_at BIGINT NOT NULL
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS deck_square_posts (
                id VARCHAR(50) PRIMARY KEY,
                source_deck_id VARCHAR(255),
                user_id VARCHAR(50) NOT NULL,
                author_name VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL,
                cards LONGTEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                INDEX (user_id),
                INDEX (created_at)
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS deck_square_likes (
                post_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                created_at BIGINT NOT NULL,
                PRIMARY KEY (post_id, user_id)
            );
        `);

        // console.log("Migration complete");
    } catch (err) {
        console.error("Migration fatal error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

migrate();
