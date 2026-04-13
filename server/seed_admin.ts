import { pool } from './db.js';
import { SERVER_CARD_LIBRARY, initServerCardLibrary } from './card_loader.js';

async function seedAdmin() {
    let conn;
    try {
        // console.log("Starting Admin Seeding...");
        await initServerCardLibrary();
        conn = await pool.getConnection();

        // 1. Ensure tables exist
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_cards (
                user_id VARCHAR(50) NOT NULL,
                card_id VARCHAR(50) NOT NULL,
                quantity INT DEFAULT 0,
                PRIMARY KEY (user_id, card_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS pack_history (
                user_id VARCHAR(50) PRIMARY KEY,
                total_packs INT DEFAULT 0,
                packs_since_sr INT DEFAULT 0,
                packs_since_ur INT DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 2. Set account balances
        const targetUserIds = ['admin', 'user_guest1', 'user_guest2', 'user_guest3', 'user_guest4', 'user_guest5'];
        
        for (const uid of targetUserIds) {
            await conn.query(
                'UPDATE users SET coins = 100000, card_crystals = 100000 WHERE id = ?',
                [uid]
            );
        }
        // console.log("✅ Admin and test account balances set to 100k/100k");

        const cardIds = Object.keys(SERVER_CARD_LIBRARY).filter(id => !id.includes(':legacy'));
        
        for (const uid of targetUserIds) {

            for (const cardId of cardIds) {
                await conn.query(
                    `INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, 4)
                     ON DUPLICATE KEY UPDATE quantity = 4`,
                    [uid, cardId]
                );
            }
        }
        // console.log(`✅ Seeded 4 copies of each card for admin and test accounts.`);

        // console.log("🚀 Admin seeding complete!");
    } catch (err) {
        console.error("❌ Seeding error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

seedAdmin();
