import * as mariadb from 'mariadb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'overheat',
  port: parseInt(process.env.DB_PORT || '3306'),
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '8')
});

async function columnExists(conn: mariadb.PoolConnection, table: string, column: string): Promise<boolean> {
    const rows = await conn.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(conn: mariadb.PoolConnection, table: string, indexName: string): Promise<boolean> {
    const rows = await conn.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
    );
    return Number(rows[0]?.count || 0) > 0;
}

async function primaryKeyColumns(conn: mariadb.PoolConnection, table: string): Promise<string[]> {
    const rows = await conn.query(
        `SELECT COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
         ORDER BY ORDINAL_POSITION`,
        [table]
    );
    return rows.map((row: any) => String(row.COLUMN_NAME));
}

async function tableExists(conn: mariadb.PoolConnection, table: string): Promise<boolean> {
    const rows = await conn.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
    );
    return Number(rows[0]?.count || 0) > 0;
}

async function migrateUserCardsTable(conn: mariadb.PoolConnection) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS user_cards (
            user_id VARCHAR(50) NOT NULL,
            card_id VARCHAR(50) NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, card_id)
        )
    `);

    const hasIdColumn = await columnExists(conn, 'user_cards', 'id');
    const hasQuantityColumn = await columnExists(conn, 'user_cards', 'quantity');
    if (!hasQuantityColumn) {
        await conn.query(`ALTER TABLE user_cards ADD COLUMN quantity INT NOT NULL DEFAULT 1 AFTER card_id`);
        await conn.query(`UPDATE user_cards SET quantity = 1 WHERE quantity IS NULL`);
    }

    const pkColumns = await primaryKeyColumns(conn, 'user_cards');
    const uniqueExists = await indexExists(conn, 'user_cards', 'PRIMARY');
    const alreadyNormalized = !hasIdColumn && uniqueExists && pkColumns.length === 2 && pkColumns[0] === 'user_id' && pkColumns[1] === 'card_id';
    if (alreadyNormalized) {
        return;
    }

    await conn.query('DROP TABLE IF EXISTS user_cards_migrated');
    await conn.query(`
        CREATE TABLE user_cards_migrated (
            user_id VARCHAR(50) NOT NULL,
            card_id VARCHAR(50) NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, card_id)
        )
    `);
    await conn.query(`
        INSERT INTO user_cards_migrated (user_id, card_id, quantity)
        SELECT user_id, card_id, SUM(COALESCE(quantity, 1)) AS quantity
        FROM user_cards
        GROUP BY user_id, card_id
    `);
    await conn.query('DROP TABLE user_cards');
    await conn.query('RENAME TABLE user_cards_migrated TO user_cards');
}

export const dbInit = async () => {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log("Connected to MariaDB successfully");

        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) NULL,
                password_hash VARCHAR(255) NOT NULL,
                display_name VARCHAR(50) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                coins BIGINT DEFAULT 100000,
                card_crystals BIGINT DEFAULT 100000,
                favorite_card_id VARCHAR(50) DEFAULT 'fav_card',
                favorite_back_id VARCHAR(50) DEFAULT 'default',
                created_at BIGINT
            )
        `);

        if (!(await columnExists(conn, 'users', 'email'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER username`);
        }
        if (!(await columnExists(conn, 'users', 'coins'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN coins BIGINT DEFAULT 100000 AFTER role`);
        }
        if (!(await columnExists(conn, 'users', 'card_crystals'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN card_crystals BIGINT DEFAULT 100000 AFTER coins`);
        }
        if (!(await columnExists(conn, 'users', 'favorite_card_id'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN favorite_card_id VARCHAR(50) DEFAULT 'fav_card' AFTER card_crystals`);
        }
        if (!(await columnExists(conn, 'users', 'favorite_back_id'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN favorite_back_id VARCHAR(50) DEFAULT 'default' AFTER favorite_card_id`);
        }
        if (!(await columnExists(conn, 'users', 'created_at'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN created_at BIGINT NULL AFTER favorite_back_id`);
        }
        if (!(await columnExists(conn, 'users', 'session_version'))) {
            await conn.query(`ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0 AFTER created_at`);
        }
        if (!(await indexExists(conn, 'users', 'uq_users_email'))) {
            await conn.query(`ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)`);
        }

        await conn.query(`
            CREATE TABLE IF NOT EXISTS games (
                id VARCHAR(50) PRIMARY KEY,
                state JSON NOT NULL,
                status INT DEFAULT 0,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS decks (
                id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                cards LONGTEXT NOT NULL,
                created_at BIGINT,
                updated_at BIGINT,
                INDEX (user_id)
            )
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
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS deck_square_likes (
                post_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                created_at BIGINT NOT NULL,
                PRIMARY KEY (post_id, user_id)
            )
        `);

        await migrateUserCardsTable(conn);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS pack_history (
                user_id VARCHAR(50) PRIMARY KEY,
                total_packs INT DEFAULT 0,
                packs_since_sr INT DEFAULT 0,
                packs_since_ur INT DEFAULT 0
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS email_verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                code VARCHAR(6) NOT NULL,
                expires_at BIGINT NOT NULL,
                created_at BIGINT NOT NULL
            )
        `);

        console.log("Database tables initialized.");
    } catch (err) {
        console.error("Failed to connect to MariaDB:", err);
    } finally {
        if (conn) conn.release();
    }
};
