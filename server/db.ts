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
  connectionLimit: 10
});

export const dbInit = async () => {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log("Connected to MariaDB successfully");
    } catch (err) {
        console.error("Failed to connect to MariaDB:", err);
    } finally {
        if (conn) conn.release();
    }
};
