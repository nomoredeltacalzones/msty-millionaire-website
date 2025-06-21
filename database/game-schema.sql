-- YieldMax Rocket Game Database Schema
-- Run this SQL to set up all game-related tables

-- Enhanced high scores table
ALTER TABLE high_scores 
ADD COLUMN IF NOT EXISTS etfs_collected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_yield DECIMAL(5,2) DEFAULT 0;

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_type)
);

-- Daily challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
    id SERIAL PRIMARY KEY,
    challenge_date DATE DEFAULT CURRENT_DATE,
    challenge_type VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    reward_points INTEGER NOT NULL,
    UNIQUE(challenge_date)
);

-- Player progress table
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

-- Power-up inventory
CREATE TABLE IF NOT EXISTS powerup_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    powerup_type VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 0,
    UNIQUE(user_id, powerup_type)
);

-- Game sessions for analytics
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    final_score INTEGER,
    final_level INTEGER,
    etfs_collected INTEGER,
    max_yield DECIMAL(5,2),
    powerups_used INTEGER DEFAULT 0,
    crashes INTEGER DEFAULT 0,
    duration_seconds INTEGER
);

-- Tournament/Competition tables
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    entry_fee INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 0,
    max_participants INTEGER,
    status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, active, completed
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_entries (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    best_score INTEGER DEFAULT 0,
    rank INTEGER,
    prize_won INTEGER DEFAULT 0,
    entered_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_high_scores_created_at ON high_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_player_progress_user_id ON player_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_start_time ON game_sessions(start_time);

-- Views for leaderboards
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT 
    player_name,
    score,
    level,
    etfs_collected,
    max_yield,
    created_at,
    RANK() OVER (ORDER BY score DESC) as rank
FROM high_scores
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY score DESC
LIMIT 100;

CREATE OR REPLACE VIEW monthly_leaderboard AS
SELECT 
    player_name,
    score,
    level,
    etfs_collected,
    max_yield,
    created_at,
    RANK() OVER (ORDER BY score DESC) as rank
FROM high_scores
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY score DESC
LIMIT 100;

-- Function to get player stats
CREATE OR REPLACE FUNCTION get_player_stats(p_user_id INTEGER)
RETURNS TABLE (
    total_games INTEGER,
    total_score BIGINT,
    avg_score NUMERIC,
    best_score INTEGER,
    total_etfs INTEGER,
    best_yield DECIMAL(5,2),
    achievements_unlocked INTEGER,
    current_streak INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(pp.games_played, 0) as total_games,
        COALESCE(pp.total_score, 0) as total_score,
        CASE 
            WHEN pp.games_played > 0 THEN pp.total_score::NUMERIC / pp.games_played
            ELSE 0
        END as avg_score,
        COALESCE((SELECT MAX(score) FROM high_scores WHERE player_name = u.full_name), 0) as best_score,
        COALESCE(pp.total_etfs_collected, 0) as total_etfs,
        COALESCE(pp.max_yield_achieved, 0) as best_yield,
        COALESCE((SELECT COUNT(*) FROM achievements WHERE user_id = p_user_id), 0)::INTEGER as achievements_unlocked,
        COALESCE(pp.daily_streak, 0) as current_streak
    FROM users u
    LEFT JOIN player_progress pp ON u.id = pp.user_id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
INSERT INTO daily_challenges (challenge_type, target_value, reward_points) 
VALUES 
    ('score', 5000, 500),
    ('etfs', 50, 300),
    ('level', 7, 400)
ON CONFLICT (challenge_date) DO NOTHING; 