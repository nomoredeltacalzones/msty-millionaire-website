# YieldMax Rocket Game Database Setup

This directory contains the database schema and setup scripts for the YieldMax Rocket Game.

## 📁 Files

- `game-schema.sql` - Complete database schema with tables, views, and functions
- `setup-game-db.js` - Node.js script to automatically set up the database
- `README.md` - This documentation file

## 🚀 Quick Setup

### Option 1: Automatic Setup (Recommended)

1. Make sure your `.env` file has the `DATABASE_URL` configured
2. Run the setup script:

```bash
cd database
node setup-game-db.js
```

### Option 2: Manual SQL Setup

1. Connect to your PostgreSQL database
2. Run the SQL schema:

```bash
psql -d your_database -f game-schema.sql
```

## 📊 Database Schema

### Core Tables

#### `high_scores` (Enhanced)
- Stores game scores with additional metrics
- Enhanced with `etfs_collected` and `max_yield` columns

#### `achievements`
- Tracks user achievements
- Links to users table with cascade delete
- Unique constraint prevents duplicate achievements

#### `daily_challenges`
- Daily challenges with random generation
- One challenge per day (unique constraint on date)
- Includes challenge type, target value, and reward points

#### `player_progress`
- Comprehensive player statistics
- Tracks total scores, games played, daily streaks
- Links to users table with cascade delete

#### `powerup_inventory`
- Player power-up inventory
- Tracks quantity of each power-up type
- Links to users table with cascade delete

### Analytics Tables

#### `game_sessions`
- Detailed game session analytics
- Tracks session duration, crashes, power-ups used
- Useful for player behavior analysis

### Tournament Tables

#### `tournaments`
- Tournament/competition management
- Supports entry fees, prize pools, participant limits
- Status tracking (upcoming, active, completed)

#### `tournament_entries`
- Player tournament participation
- Tracks best scores, rankings, and prizes won

### Views

#### `weekly_leaderboard`
- Top 100 players for the last 7 days
- Includes ranking information

#### `monthly_leaderboard`
- Top 100 players for the last 30 days
- Includes ranking information

### Functions

#### `get_player_stats(user_id)`
- Returns comprehensive player statistics
- Includes total games, scores, achievements, streaks
- Calculates averages and best performances

## 🔧 Performance Optimizations

### Indexes Created
- `idx_high_scores_created_at` - For date-based queries
- `idx_high_scores_score` - For leaderboard queries
- `idx_achievements_user_id` - For user achievement lookups
- `idx_player_progress_user_id` - For user progress lookups
- `idx_game_sessions_user_id` - For session analytics
- `idx_game_sessions_start_time` - For time-based analytics

### Query Optimizations
- Views for common leaderboard queries
- Function for complex player statistics
- Proper foreign key relationships
- Unique constraints for data integrity

## 🧪 Testing

The setup script includes:
- Table creation verification
- View creation verification
- Function testing
- Sample data insertion
- Player stats function testing

## 📈 Sample Data

The setup script inserts sample data for testing:
- Sample achievement for user ID 1
- Sample player progress data
- Sample power-up inventory

## 🔒 Security Features

- Foreign key constraints with cascade delete
- Unique constraints to prevent duplicates
- Parameterized queries in the setup script
- User data isolation by user_id

## 🚀 Production Deployment

For production deployment:

1. **Backup existing data** (if any)
2. **Run the setup script** during maintenance window
3. **Verify all tables and views** were created
4. **Test the API endpoints** with the new schema
5. **Monitor performance** of new queries

## 📋 Verification Commands

After setup, verify the installation:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%game%' OR table_name IN ('achievements', 'daily_challenges', 'player_progress', 'powerup_inventory');

-- Check views
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('weekly_leaderboard', 'monthly_leaderboard');

-- Check function
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_player_stats';

-- Test player stats function
SELECT * FROM get_player_stats(1);
```

## 🐛 Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure database user has CREATE TABLE, CREATE VIEW, CREATE FUNCTION permissions

2. **Foreign Key Errors**
   - Ensure the `users` table exists before running the schema

3. **Duplicate Key Errors**
   - The schema uses `IF NOT EXISTS` and `ON CONFLICT` to handle duplicates safely

4. **Connection Errors**
   - Verify `DATABASE_URL` in your `.env` file
   - Check database connectivity

### Error Recovery

If the setup fails partway through:

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
   ```
3. **Re-run the setup script**

## 📞 Support

If you encounter issues:
1. Check the error logs
2. Verify database permissions
3. Test database connectivity
4. Review the schema for syntax errors

The setup script provides detailed feedback on each step of the process. 