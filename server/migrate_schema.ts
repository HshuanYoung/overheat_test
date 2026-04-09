import { pool } from './db';

async function migrate() {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Add favorite_card_id and favorite_back_id to users if not exists
        try {
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_card_id VARCHAR(50) DEFAULT 'fav_card';`);
            await conn.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_back_id VARCHAR(50) DEFAULT 'default';`);
        } catch (e: any) {
            console.log('Column add error:', e.message);
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

        console.log("Migration complete");
    } catch (err) {
        console.error("Migration fatal error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

migrate();
