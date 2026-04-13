import { pool } from './db';

async function deleteUserCards() {
    let conn;
    try {
        console.log("Starting deletion of cards for admin and test accounts...");
        conn = await pool.getConnection();

        const targetUserIds = ['admin', 'user_guest1', 'user_guest2', 'user_guest3', 'user_guest4', 'user_guest5'];

        for (const uid of targetUserIds) {
            // Delete cards
            await conn.query('DELETE FROM user_cards WHERE user_id = ?', [uid]);
            // Reset pack history
            await conn.query('DELETE FROM pack_history WHERE user_id = ?', [uid]);
            console.log(`✅ Deleted cards and pack history for user: ${uid}`);
        }

        console.log("🚀 Deletion complete!");
    } catch (err) {
        console.error("❌ Deletion error:", err);
    } finally {
        if (conn) conn.release();
        process.exit(0);
    }
}

deleteUserCards();
