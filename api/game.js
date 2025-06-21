// api/game.js - Enhanced version
const express = require('express');
const router = express.Router();
const db = require('./config/database');
const { authenticateToken } = require('./middleware/auth');

// Initialize game tables
async function initializeGameTables() {
    try {
        // High scores table (already exists)
        await db.query(`
            CREATE TABLE IF NOT EXISTS high_scores (
                id SERIAL PRIMARY KEY,
                player_name VARCHAR(50) NOT NULL,
                score INTEGER NOT NULL,
                level INTEGER NOT NULL,
                etfs_collected INTEGER DEFAULT 0,
                max_yield DECIMAL(5,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Achievements table
        await db.query(`
            CREATE TABLE IF NOT EXISTS achievements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                achievement_type VARCHAR(50) NOT NULL,
                unlocked_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, achievement_type)
            );
        `);

        // Daily challenges table
        await db.query(`
            CREATE TABLE IF NOT EXISTS daily_challenges (
                id SERIAL PRIMARY KEY,
                challenge_date DATE DEFAULT CURRENT_DATE,
                challenge_type VARCHAR(50) NOT NULL,
                target_value INTEGER NOT NULL,
                reward_points INTEGER NOT NULL,
                UNIQUE(challenge_date)
            );
        `);

        // Player progress table
        await db.query(`
            CREATE TABLE IF NOT EXISTS player_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                total_score BIGINT DEFAULT 0,
                total_etfs_collected INTEGER DEFAULT 0,
                max_level_reached INTEGER DEFAULT 1,
                max_yield_achieved DECIMAL(5,2) DEFAULT 0,
                games_played INTEGER DEFAULT 0,
                daily_streak INTEGER DEFAULT 0,
                last_play_date DATE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id)
            );
        `);

        // Power-up inventory
        await db.query(`
            CREATE TABLE IF NOT EXISTS powerup_inventory (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                powerup_type VARCHAR(50) NOT NULL,
                quantity INTEGER DEFAULT 0,
                UNIQUE(user_id, powerup_type)
            );
        `);

        console.log('Game tables initialized successfully');
    } catch (error) {
        console.error('Error initializing game tables:', error);
    }
}

// Initialize on startup
initializeGameTables();

// Achievement definitions
const ACHIEVEMENTS = {
    FIRST_FLIGHT: { name: 'First Flight', description: 'Complete your first game', points: 100 },
    YIELD_MASTER: { name: 'Yield Master', description: 'Reach 100% yield in a single game', points: 500 },
    ETF_COLLECTOR: { name: 'ETF Collector', description: 'Collect 100 ETFs in a single game', points: 300 },
    LEVEL_10: { name: 'Market Veteran', description: 'Reach level 10', points: 400 },
    STREAK_7: { name: 'Week Warrior', description: 'Play 7 days in a row', points: 700 },
    STREAK_30: { name: 'Monthly Master', description: 'Play 30 days in a row', points: 3000 },
    HIGH_SCORER: { name: 'High Scorer', description: 'Score over 10,000 points', points: 1000 },
    SPEED_DEMON: { name: 'Speed Demon', description: 'Collect 10 ETFs in 30 seconds', points: 600 },
    NO_CRASH: { name: 'Steady Hands', description: 'Reach level 5 without losing a life', points: 800 },
    PORTFOLIO_BUILDER: { name: 'Portfolio Builder', description: 'Collect all 5 ETF types in one game', points: 400 }
};

// POST /api/game/score - Enhanced version
router.post('/score', async (req, res) => {
    const { playerName, score, level, etfsCollected, maxYield } = req.body;

    if (!playerName || typeof score === 'undefined' || typeof level === 'undefined') {
        return res.status(400).json({ error: 'Player name, score, and level are required.' });
    }

    try {
        // Save score
        const query = `
            INSERT INTO high_scores (player_name, score, level, etfs_collected, max_yield)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [playerName, score, level, etfsCollected || 0, maxYield || 0];
        const result = await db.query(query, values);
        
        // Check for new achievements (if user is authenticated)
        const userId = req.user?.userId;
        let unlockedAchievements = [];
        
        if (userId) {
            unlockedAchievements = await checkAchievements(userId, {
                score,
                level,
                etfsCollected,
                maxYield
            });
            
            // Update player progress
            await updatePlayerProgress(userId, {
                score,
                level,
                etfsCollected,
                maxYield
            });
        }
        
        res.status(201).json({ 
            success: true, 
            data: result.rows[0],
            achievements: unlockedAchievements
        });
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/game/leaderboard - Enhanced with filters
router.get('/leaderboard', async (req, res) => {
    const { period = 'all', limit = 10 } = req.query;
    
    try {
        let dateFilter = '';
        if (period === 'today') {
            dateFilter = 'WHERE DATE(created_at) = CURRENT_DATE';
        } else if (period === 'week') {
            dateFilter = 'WHERE created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === 'month') {
            dateFilter = 'WHERE created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }
        
        const query = `
            SELECT player_name, score, level, etfs_collected, max_yield, created_at
            FROM high_scores
            ${dateFilter}
            ORDER BY score DESC, created_at DESC
            LIMIT $1;
        `;
        const result = await db.query(query, [limit]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/game/daily-challenge
router.get('/daily-challenge', async (req, res) => {
    try {
        // Check if today's challenge exists
        let challenge = await db.getOne(
            'SELECT * FROM daily_challenges WHERE challenge_date = CURRENT_DATE'
        );
        
        if (!challenge) {
            // Generate new daily challenge
            const challengeTypes = [
                { type: 'score', target: 5000 + Math.floor(Math.random() * 5000), reward: 500 },
                { type: 'etfs', target: 30 + Math.floor(Math.random() * 20), reward: 300 },
                { type: 'level', target: 5 + Math.floor(Math.random() * 5), reward: 400 },
                { type: 'yield', target: 50 + Math.floor(Math.random() * 50), reward: 600 },
                { type: 'no_crash', target: 3, reward: 700 } // Reach level 3 without losing a life
            ];
            
            const selected = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
            
            challenge = await db.insert('daily_challenges', {
                challenge_type: selected.type,
                target_value: selected.target,
                reward_points: selected.reward
            });
        }
        
        res.json(challenge);
    } catch (error) {
        console.error('Error getting daily challenge:', error);
        res.status(500).json({ error: 'Failed to get daily challenge' });
    }
});

// GET /api/game/achievements (authenticated)
router.get('/achievements', authenticateToken, async (req, res) => {
    try {
        const unlocked = await db.getMany(
            'SELECT achievement_type, unlocked_at FROM achievements WHERE user_id = $1',
            [req.user.userId]
        );
        
        const achievements = Object.entries(ACHIEVEMENTS).map(([key, achievement]) => {
            const unlockedAchievement = unlocked.find(a => a.achievement_type === key);
            return {
                id: key,
                ...achievement,
                unlocked: !!unlockedAchievement,
                unlockedAt: unlockedAchievement?.unlocked_at
            };
        });
        
        res.json(achievements);
    } catch (error) {
        console.error('Error getting achievements:', error);
        res.status(500).json({ error: 'Failed to get achievements' });
    }
});

// GET /api/game/progress (authenticated)
router.get('/progress', authenticateToken, async (req, res) => {
    try {
        let progress = await db.getOne(
            'SELECT * FROM player_progress WHERE user_id = $1',
            [req.user.userId]
        );
        
        if (!progress) {
            // Create initial progress record
            progress = await db.insert('player_progress', {
                user_id: req.user.userId
            });
        }
        
        res.json(progress);
    } catch (error) {
        console.error('Error getting progress:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

// GET /api/game/powerups (authenticated)
router.get('/powerups', authenticateToken, async (req, res) => {
    try {
        const powerups = await db.getMany(
            'SELECT powerup_type, quantity FROM powerup_inventory WHERE user_id = $1 AND quantity > 0',
            [req.user.userId]
        );
        
        res.json(powerups);
    } catch (error) {
        console.error('Error getting powerups:', error);
        res.status(500).json({ error: 'Failed to get powerups' });
    }
});

// POST /api/game/use-powerup (authenticated)
router.post('/use-powerup', authenticateToken, async (req, res) => {
    const { powerupType } = req.body;
    
    try {
        // Check if user has the powerup
        const inventory = await db.getOne(
            'SELECT * FROM powerup_inventory WHERE user_id = $1 AND powerup_type = $2 AND quantity > 0',
            [req.user.userId, powerupType]
        );
        
        if (!inventory) {
            return res.status(400).json({ error: 'Powerup not available' });
        }
        
        // Decrease quantity
        await db.query(
            'UPDATE powerup_inventory SET quantity = quantity - 1 WHERE id = $1',
            [inventory.id]
        );
        
        res.json({ success: true, remaining: inventory.quantity - 1 });
    } catch (error) {
        console.error('Error using powerup:', error);
        res.status(500).json({ error: 'Failed to use powerup' });
    }
});

// GET /api/game/stats/players - Get total unique players
router.get('/stats/players', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT COUNT(DISTINCT player_name) as count
            FROM high_scores
        `);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ error: 'Failed to get player stats' });
    }
});

// GET /api/game/stats/games - Get total games played
router.get('/stats/games', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM high_scores
        `);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting game stats:', error);
        res.status(500).json({ error: 'Failed to get game stats' });
    }
});

// GET /api/game/stats/high-score - Get current high score
router.get('/stats/high-score', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT MAX(score) as high_score
            FROM high_scores
        `);
        res.json({ highScore: parseInt(result.rows[0].high_score) || 0 });
    } catch (error) {
        console.error('Error getting high score:', error);
        res.status(500).json({ error: 'Failed to get high score' });
    }
});

// GET /api/game/stats/summary - Get all stats in one call
router.get('/stats/summary', async (req, res) => {
    try {
        const [playersResult, gamesResult, highScoreResult] = await Promise.all([
            db.query('SELECT COUNT(DISTINCT player_name) as count FROM high_scores'),
            db.query('SELECT COUNT(*) as count FROM high_scores'),
            db.query('SELECT MAX(score) as high_score FROM high_scores')
        ]);
        
        res.json({
            totalPlayers: parseInt(playersResult.rows[0].count),
            totalGames: parseInt(gamesResult.rows[0].count),
            highScore: parseInt(highScoreResult.rows[0].high_score) || 0
        });
    } catch (error) {
        console.error('Error getting stats summary:', error);
        res.status(500).json({ error: 'Failed to get stats summary' });
    }
});

// GET /api/game/leaderboard/weekly - Get weekly leaderboard using view
router.get('/leaderboard/weekly', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM weekly_leaderboard LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting weekly leaderboard:', error);
        res.status(500).json({ error: 'Failed to get weekly leaderboard' });
    }
});

// GET /api/game/leaderboard/monthly - Get monthly leaderboard using view
router.get('/leaderboard/monthly', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM monthly_leaderboard LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting monthly leaderboard:', error);
        res.status(500).json({ error: 'Failed to get monthly leaderboard' });
    }
});

// GET /api/game/player-stats/:userId - Get comprehensive player stats using function
router.get('/player-stats/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Verify user can only access their own stats
        if (req.user.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const result = await db.query('SELECT * FROM get_player_stats($1)', [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ error: 'Failed to get player stats' });
    }
});

// POST /api/game/session/start - Start a new game session
router.post('/session/start', authenticateToken, async (req, res) => {
    try {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const result = await db.insert('game_sessions', {
            user_id: req.user.userId,
            session_id: sessionId,
            start_time: new Date()
        });
        
        res.json({ 
            sessionId: sessionId,
            sessionId: result.id 
        });
    } catch (error) {
        console.error('Error starting game session:', error);
        res.status(500).json({ error: 'Failed to start game session' });
    }
});

// POST /api/game/session/end - End a game session
router.post('/session/end', authenticateToken, async (req, res) => {
    const { sessionId, finalScore, finalLevel, etfsCollected, maxYield, powerupsUsed, crashes, durationSeconds } = req.body;
    
    try {
        // Find the session
        const session = await db.getOne(
            'SELECT * FROM game_sessions WHERE session_id = $1 AND user_id = $2 AND end_time IS NULL',
            [sessionId, req.user.userId]
        );
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found or already ended' });
        }
        
        // Update the session
        await db.query(`
            UPDATE game_sessions 
            SET end_time = NOW(),
                final_score = $1,
                final_level = $2,
                etfs_collected = $3,
                max_yield = $4,
                powerups_used = $5,
                crashes = $6,
                duration_seconds = $7
            WHERE id = $8
        `, [finalScore, finalLevel, etfsCollected, maxYield, powerupsUsed, crashes, durationSeconds, session.id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error ending game session:', error);
        res.status(500).json({ error: 'Failed to end game session' });
    }
});

// GET /api/game/analytics/sessions - Get user's game session analytics
router.get('/analytics/sessions', authenticateToken, async (req, res) => {
    const { limit = 10, offset = 0 } = req.query;
    
    try {
        const result = await db.query(`
            SELECT 
                session_id,
                start_time,
                end_time,
                final_score,
                final_level,
                etfs_collected,
                max_yield,
                powerups_used,
                crashes,
                duration_seconds
            FROM game_sessions 
            WHERE user_id = $1 
            ORDER BY start_time DESC 
            LIMIT $2 OFFSET $3
        `, [req.user.userId, limit, offset]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting session analytics:', error);
        res.status(500).json({ error: 'Failed to get session analytics' });
    }
});

// GET /api/game/analytics/summary - Get user's analytics summary
router.get('/analytics/summary', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_sessions,
                AVG(final_score) as avg_score,
                MAX(final_score) as best_score,
                AVG(duration_seconds) as avg_duration,
                SUM(powerups_used) as total_powerups_used,
                SUM(crashes) as total_crashes,
                AVG(etfs_collected) as avg_etfs_collected,
                MAX(max_yield) as best_yield
            FROM game_sessions 
            WHERE user_id = $1 AND end_time IS NOT NULL
        `, [req.user.userId]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error getting analytics summary:', error);
        res.status(500).json({ error: 'Failed to get analytics summary' });
    }
});

// Helper function to check achievements
async function checkAchievements(userId, gameData) {
    const unlocked = [];
    
    try {
        // Get existing achievements
        const existing = await db.getMany(
            'SELECT achievement_type FROM achievements WHERE user_id = $1',
            [userId]
        );
        const existingTypes = existing.map(a => a.achievement_type);
        
        // Check each achievement
        for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
            if (existingTypes.includes(key)) continue;
            
            let earned = false;
            
            switch (key) {
                case 'FIRST_FLIGHT':
                    earned = true; // Always earned on first game
                    break;
                case 'YIELD_MASTER':
                    earned = gameData.maxYield >= 100;
                    break;
                case 'ETF_COLLECTOR':
                    earned = gameData.etfsCollected >= 100;
                    break;
                case 'LEVEL_10':
                    earned = gameData.level >= 10;
                    break;
                case 'HIGH_SCORER':
                    earned = gameData.score >= 10000;
                    break;
                // Add more achievement checks as needed
            }
            
            if (earned) {
                await db.insert('achievements', {
                    user_id: userId,
                    achievement_type: key
                });
                unlocked.push({ ...achievement, id: key });
            }
        }
    } catch (error) {
        console.error('Error checking achievements:', error);
    }
    
    return unlocked;
}

// Helper function to update player progress
async function updatePlayerProgress(userId, gameData) {
    try {
        // Get current progress
        let progress = await db.getOne(
            'SELECT * FROM player_progress WHERE user_id = $1',
            [userId]
        );
        
        if (!progress) {
            // Create new progress record
            await db.insert('player_progress', {
                user_id: userId,
                total_score: gameData.score,
                total_etfs_collected: gameData.etfsCollected || 0,
                max_level_reached: gameData.level,
                max_yield_achieved: gameData.maxYield || 0,
                games_played: 1,
                daily_streak: 1,
                last_play_date: new Date()
            });
        } else {
            // Update progress
            const lastPlayDate = new Date(progress.last_play_date);
            const today = new Date();
            const daysSinceLastPlay = Math.floor((today - lastPlayDate) / (1000 * 60 * 60 * 24));
            
            let newStreak = progress.daily_streak;
            if (daysSinceLastPlay === 1) {
                newStreak = progress.daily_streak + 1;
            } else if (daysSinceLastPlay > 1) {
                newStreak = 1;
            }
            
            await db.query(`
                UPDATE player_progress 
                SET total_score = total_score + $2,
                    total_etfs_collected = total_etfs_collected + $3,
                    max_level_reached = GREATEST(max_level_reached, $4),
                    max_yield_achieved = GREATEST(max_yield_achieved, $5),
                    games_played = games_played + 1,
                    daily_streak = $6,
                    last_play_date = CURRENT_DATE,
                    updated_at = NOW()
                WHERE user_id = $1
            `, [userId, gameData.score, gameData.etfsCollected || 0, 
                gameData.level, gameData.maxYield || 0, newStreak]);
            
            // Check streak achievements
            if (newStreak === 7) {
                await checkAchievements(userId, { streak: 7 });
            } else if (newStreak === 30) {
                await checkAchievements(userId, { streak: 30 });
            }
        }
    } catch (error) {
        console.error('Error updating player progress:', error);
    }
}

module.exports = router; 