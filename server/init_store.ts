import { pool } from './db';
import fs from 'fs';
import path from 'path';


async function initStore() {
    // console.log("Starting Store Schema Migration...");
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Add coins column to users table
        try {
            await conn.query(`ALTER TABLE users ADD COLUMN coins INT DEFAULT 100000`);
            // console.log("✅ Added coins column to users");
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                // console.log("⚠️ coins column already exists");
            } else {
                throw e;
            }
        }

        // Set all existing users to 100000 coins
        await conn.query(`UPDATE users SET coins = 100000 WHERE coins IS NULL OR coins = 0`);
        // console.log("✅ Set initial coins for existing users");

        // 2. Create user_cards table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_cards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                card_id VARCHAR(20) NOT NULL,
                quantity INT DEFAULT 0,
                UNIQUE KEY unique_user_card (user_id, card_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // console.log("✅ user_cards table ensured");

        // 3. Create pack_history table for pity tracking
        await conn.query(`
            CREATE TABLE IF NOT EXISTS pack_history (
                user_id VARCHAR(50) PRIMARY KEY,
                total_packs INT DEFAULT 0,
                packs_since_sr INT DEFAULT 0,
                packs_since_ur INT DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // console.log("✅ pack_history table ensured");

        // 4. Give all existing users the initial card collection (4 copies of each card)
        const users = await conn.query('SELECT id FROM users');
        
        // Scan pics folder for card IDs
        const cardIds: string[] = [];
        const picsDir = path.join(process.cwd(), 'pics');
        if (fs.existsSync(picsDir)) {
            const rarities = fs.readdirSync(picsDir);
            for (const r of rarities) {
                const rPath = path.join(picsDir, r);
                if (fs.statSync(rPath).isDirectory()) {
                    const files = fs.readdirSync(rPath);
                    for (const file of files) {
                        if (file.endsWith('.jpg')) {
                            cardIds.push(file.replace('.jpg', ''));
                        }
                    }
                }
            }
        }


        for (const user of users) {
            for (const cardId of cardIds) {
                await conn.query(
                    `INSERT IGNORE INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, 4)`,
                    [user.id, cardId]
                );
            }
            // Initialize pack history
            await conn.query(
                `INSERT IGNORE INTO pack_history (user_id, total_packs, packs_since_sr, packs_since_ur) VALUES (?, 0, 0, 0)`,
                [user.id]
            );
        }
        // console.log("✅ Initial card collection given to all users (4 copies each)");

        // console.log("🚀 Store schema migration complete!");
    } catch (err) {
        console.error("❌ Migration error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

initStore();
