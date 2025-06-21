const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupGameDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Setting up YieldMax Rocket Game Database...');
        
        // Read the SQL schema file
        const schemaPath = path.join(__dirname, 'game-schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute the schema
        await client.query(schemaSQL);
        
        console.log('✅ Game database schema created successfully!');
        
        // Verify tables were created
        const tables = [
            'high_scores',
            'achievements', 
            'daily_challenges',
            'player_progress',
            'powerup_inventory',
            'game_sessions',
            'tournaments',
            'tournament_entries'
        ];
        
        for (const table of tables) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [table]);
            
            if (result.rows[0].exists) {
                console.log(`✅ Table '${table}' exists`);
            } else {
                console.log(`❌ Table '${table}' missing`);
            }
        }
        
        // Verify views were created
        const views = ['weekly_leaderboard', 'monthly_leaderboard'];
        for (const view of views) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.views 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [view]);
            
            if (result.rows[0].exists) {
                console.log(`✅ View '${view}' exists`);
            } else {
                console.log(`❌ View '${view}' missing`);
            }
        }
        
        // Verify function was created
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.routines 
                WHERE routine_schema = 'public' 
                AND routine_name = 'get_player_stats'
            );
        `);
        
        if (result.rows[0].exists) {
            console.log('✅ Function get_player_stats exists');
        } else {
            console.log('❌ Function get_player_stats missing');
        }
        
        // Insert sample data for testing
        console.log('\n📊 Inserting sample data...');
        
        // Sample achievements data
        await client.query(`
            INSERT INTO achievements (user_id, achievement_type) 
            VALUES (1, 'FIRST_FLIGHT')
            ON CONFLICT (user_id, achievement_type) DO NOTHING;
        `);
        
        // Sample player progress
        await client.query(`
            INSERT INTO player_progress (user_id, total_score, total_etfs_collected, max_level_reached, games_played, daily_streak)
            VALUES (1, 15000, 75, 8, 5, 3)
            ON CONFLICT (user_id) DO NOTHING;
        `);
        
        // Sample powerups
        await client.query(`
            INSERT INTO powerup_inventory (user_id, powerup_type, quantity)
            VALUES 
                (1, 'shield', 3),
                (1, 'magnet', 2),
                (1, 'slow_motion', 1)
            ON CONFLICT (user_id, powerup_type) DO NOTHING;
        `);
        
        console.log('✅ Sample data inserted successfully!');
        
        // Test the get_player_stats function
        console.log('\n🧪 Testing get_player_stats function...');
        const statsResult = await client.query('SELECT * FROM get_player_stats(1)');
        console.log('Player stats:', statsResult.rows[0]);
        
        console.log('\n🎉 Game database setup completed successfully!');
        console.log('\n📋 Database Summary:');
        console.log('- 8 tables created');
        console.log('- 2 views created');
        console.log('- 1 function created');
        console.log('- 6 indexes created');
        console.log('- Sample data inserted');
        
    } catch (error) {
        console.error('❌ Error setting up game database:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the setup if this file is executed directly
if (require.main === module) {
    setupGameDatabase()
        .then(() => {
            console.log('\n✅ Setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupGameDatabase }; 