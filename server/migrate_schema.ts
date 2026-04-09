import { pool } from './db';

async function migrate() {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Add favorite_card_id, favorite_back_id, coins, and card_crystals to users if not exists
        try {
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_card_id VARCHAR(50) DEFAULT 'fav_card';`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_back_id VARCHAR(50) DEFAULT 'default';`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS coins BIGINT DEFAULT 100000;`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS card_crystals BIGINT DEFAULT 100000;`);
            
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

        // console.log("Migration complete");
    } catch (err) {
        console.error("Migration fatal error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

migrate();
