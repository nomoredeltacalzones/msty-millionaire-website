# 🚀 YieldMax Rocket Game Database Setup Guide

This guide will help you set up the complete database schema for the YieldMax Rocket Game with all features including achievements, daily challenges, player progress tracking, and analytics.

## 📋 Prerequisites

- PostgreSQL database (version 12 or higher)
- Node.js (version 16 or higher)
- Access to your database with CREATE TABLE, CREATE VIEW, and CREATE FUNCTION permissions
- `.env` file with `DATABASE_URL` configured

## 🚀 Quick Setup (Recommended)

### Step 1: Verify Environment
Make sure your `.env` file contains:
```env
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=development
```

### Step 2: Run the Setup Script
```bash
# From the project root directory
npm run setup:db
```

This will:
- ✅ Create all game tables
- ✅ Set up database views for leaderboards
- ✅ Create the player stats function
- ✅ Add performance indexes
- ✅ Insert sample data for testing
- ✅ Verify all components were created successfully

## 📊 What Gets Created

### Tables (8 total)
1. **`high_scores`** (enhanced) - Game scores with ETF collection data
2. **`achievements`** - User achievement tracking
3. **`daily_challenges`** - Daily challenge system
4. **`player_progress`** - Comprehensive player statistics
5. **`powerup_inventory`** - Player power-up management
6. **`game_sessions`** - Detailed session analytics
7. **`tournaments`** - Tournament management
8. **`tournament_entries`** - Tournament participation

### Views (2 total)
1. **`weekly_leaderboard`** - Top 100 players for last 7 days
2. **`monthly_leaderboard`** - Top 100 players for last 30 days

### Functions (1 total)
1. **`get_player_stats(user_id)`** - Comprehensive player statistics

### Indexes (6 total)
- Performance optimizations for leaderboards and user lookups

## 🧪 Testing the Setup

### 1. Test API Endpoints
Use the provided test page: `/game-api-test.html`

### 2. Test Database Function
```sql
-- Test the player stats function
SELECT * FROM get_player_stats(1);

-- Check weekly leaderboard
SELECT * FROM weekly_leaderboard LIMIT 5;

-- Check monthly leaderboard  
SELECT * FROM monthly_leaderboard LIMIT 5;
```

### 3. Test Game Integration
1. Navigate to `/game/` to access the game
2. Play a game and submit a score
3. Check that achievements are unlocked
4. Verify progress is tracked

## 📈 New API Endpoints Available

### Public Endpoints
- `GET /api/game/leaderboard/weekly` - Weekly leaderboard using database view
- `GET /api/game/leaderboard/monthly` - Monthly leaderboard using database view
- `GET /api/game/stats/summary` - All game statistics in one call

### Authenticated Endpoints
- `GET /api/game/player-stats/:userId` - Comprehensive player statistics
- `POST /api/game/session/start` - Start a new game session
- `POST /api/game/session/end` - End a game session with analytics
- `GET /api/game/analytics/sessions` - User's game session history
- `GET /api/game/analytics/summary` - User's analytics summary

## 🔧 Manual Setup (Alternative)

If you prefer to run the SQL manually:

### Step 1: Connect to Database
```bash
psql -d your_database_name
```

### Step 2: Run Schema
```sql
\i database/game-schema.sql
```

### Step 3: Verify Setup
```sql
-- Check tables
\dt *game*
\dt achievements
\dt daily_challenges
\dt player_progress
\dt powerup_inventory

-- Check views
\dv weekly_leaderboard
\dv monthly_leaderboard

-- Check function
\df get_player_stats
```

## 🎮 Game Features Now Available

### Achievement System
- 10 predefined achievements with different difficulty levels
- Automatic unlocking based on gameplay
- Visual notifications when earned

### Daily Challenges
- Randomly generated challenges each day
- 5 different challenge types
- Reward points for completion

### Player Progress
- Comprehensive statistics tracking
- Daily streak counting
- Cross-session persistence

### Analytics
- Detailed session tracking
- Performance metrics
- Player behavior analysis

### Leaderboards
- Real-time weekly and monthly rankings
- Optimized database views for performance
- Ranking information included

## 🚨 Troubleshooting

### Common Issues

#### 1. Permission Errors
```
Error: permission denied for schema public
```
**Solution:** Ensure your database user has CREATE privileges:
```sql
GRANT CREATE ON SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
```

#### 2. Foreign Key Errors
```
Error: relation "users" does not exist
```
**Solution:** Ensure the `users` table exists before running the game schema.

#### 3. Connection Errors
```
Error: connect ECONNREFUSED
```
**Solution:** Verify your `DATABASE_URL` in the `.env` file.

#### 4. Duplicate Key Errors
```
Error: duplicate key value violates unique constraint
```
**Solution:** The schema uses `IF NOT EXISTS` and `ON CONFLICT` to handle duplicates safely.

### Recovery Steps

If setup fails partway through:

1. **Check the error message** for specific issues
2. **Drop problematic objects** if needed:
   ```sql
   DROP TABLE IF EXISTS achievements CASCADE;
   DROP TABLE IF EXISTS daily_challenges CASCADE;
   DROP TABLE IF EXISTS player_progress CASCADE;
   DROP TABLE IF EXISTS powerup_inventory CASCADE;
   DROP TABLE IF EXISTS game_sessions CASCADE;
   DROP TABLE IF EXISTS tournaments CASCADE;
   DROP TABLE IF EXISTS tournament_entries CASCADE;
   DROP VIEW IF EXISTS weekly_leaderboard CASCADE;
   DROP VIEW IF EXISTS monthly_leaderboard CASCADE;
   DROP FUNCTION IF EXISTS get_player_stats(INTEGER) CASCADE;
   ```
3. **Re-run the setup script**

## 📊 Performance Monitoring

After setup, monitor these metrics:

### Database Performance
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename LIKE '%game%' OR tablename IN ('achievements', 'daily_challenges', 'player_progress');

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename LIKE '%game%' OR tablename IN ('achievements', 'daily_challenges', 'player_progress');
```

### API Performance
- Monitor response times for leaderboard queries
- Check session analytics endpoint performance
- Verify achievement checking doesn't slow down score submission

## 🔄 Maintenance

### Regular Tasks
1. **Monitor table growth** - Game data can grow quickly
2. **Archive old sessions** - Consider archiving sessions older than 6 months
3. **Update statistics** - Monitor and update game statistics regularly
4. **Backup data** - Ensure regular backups of game data

### Cleanup Scripts
```sql
-- Archive old game sessions (run monthly)
INSERT INTO game_sessions_archive 
SELECT * FROM game_sessions 
WHERE start_time < CURRENT_DATE - INTERVAL '6 months';

DELETE FROM game_sessions 
WHERE start_time < CURRENT_DATE - INTERVAL '6 months';

-- Clean up orphaned data
DELETE FROM achievements WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM player_progress WHERE user_id NOT IN (SELECT id FROM users);
```

## 🎉 Success!

Once setup is complete, you'll have:

- ✅ Complete game database schema
- ✅ Performance-optimized queries
- ✅ Analytics and tracking capabilities
- ✅ Achievement and challenge systems
- ✅ Tournament infrastructure
- ✅ Comprehensive API endpoints

The game is now ready for production use with full feature support!

## 📞 Support

If you encounter issues:
1. Check the error logs in the setup script output
2. Verify database permissions and connectivity
3. Review the schema for syntax errors
4. Test individual components step by step

The setup script provides detailed feedback on each step to help identify and resolve issues quickly. 