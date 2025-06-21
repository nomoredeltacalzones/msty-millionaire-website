const { Pool } = require('pg');
require('dotenv').config();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Test connection on startup
pool.on('connect', () => {
    console.log('✅ Database pool connected');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

// Helper function to test connection
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize connection test
testConnection();

// Create high_scores table if it doesn't exist
const initializeDatabase = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS high_scores (
            id SERIAL PRIMARY KEY,
            player_name VARCHAR(50) NOT NULL,
            score INTEGER NOT NULL,
            level INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;
    try {
        const client = await pool.connect();
        await client.query(createTableQuery);
        client.release();
        console.log('Database initialized: high_scores table is ready.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
    
    // Helper methods for common queries
    async getOne(text, params) {
        const result = await pool.query(text, params);
        return result.rows[0];
    },
    
    async getMany(text, params) {
        const result = await pool.query(text, params);
        return result.rows;
    },
    
    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
            INSERT INTO ${table} (${keys.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        return result.rows[0];
    },
    
    async update(table, id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
        
        const query = `
            UPDATE ${table}
            SET ${setClause}, updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [id, ...values]);
        return result.rows[0];
    },
    
    async delete(table, id) {
        const query = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }
};
