# Enhanced Game API Documentation

## Overview

The Enhanced Game API provides a comprehensive gaming system with achievements, daily challenges, player progress tracking, and power-up management. This system is designed to increase user engagement and provide a more immersive gaming experience.

## Features

### 🏆 Achievement System
- **10 predefined achievements** with different difficulty levels
- **Automatic unlocking** based on gameplay performance
- **Point rewards** for each achievement
- **Visual notifications** when achievements are unlocked

### 📅 Daily Challenges
- **Randomly generated challenges** each day
- **Different challenge types**: score, ETFs collected, level, yield, no-crash
- **Reward points** for completing challenges
- **Persistent across sessions**

### 📊 Player Progress Tracking
- **Comprehensive statistics**: total score, games played, daily streaks
- **Performance metrics**: max level reached, max yield achieved
- **Streak tracking** for consecutive days played
- **Cross-session persistence**

### ⚡ Power-up System
- **Inventory management** for power-ups
- **Usage tracking** and quantity management
- **Authentication required** for power-up features

## Database Schema

### Tables Created

#### `high_scores` (Enhanced)
```sql
CREATE TABLE high_scores (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL,
    etfs_collected INTEGER DEFAULT 0,
    max_yield DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `achievements`
```sql
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_type)
);
```

#### `daily_challenges`
```sql
CREATE TABLE daily_challenges (
    id SERIAL PRIMARY KEY,
    challenge_date DATE DEFAULT CURRENT_DATE,
    challenge_type VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    reward_points INTEGER NOT NULL,
    UNIQUE(challenge_date)
);
```

#### `player_progress`
```sql
CREATE TABLE player_progress (
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
```

#### `powerup_inventory`
```sql
CREATE TABLE powerup_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    powerup_type VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 0,
    UNIQUE(user_id, powerup_type)
);
```

## API Endpoints

### POST `/api/game/score`
Submit a new game score with enhanced data.

**Request Body:**
```json
{
    "playerName": "string",
    "score": "number",
    "level": "number",
    "etfsCollected": "number (optional)",
    "maxYield": "number (optional)"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "player_name": "Player1",
        "score": 5000,
        "level": 5,
        "etfs_collected": 25,
        "max_yield": 75.5,
        "created_at": "2024-01-01T12:00:00Z"
    },
    "achievements": [
        {
            "id": "FIRST_FLIGHT",
            "name": "First Flight",
            "description": "Complete your first game",
            "points": 100
        }
    ]
}
```

### GET `/api/game/leaderboard`
Get leaderboard with optional filters.

**Query Parameters:**
- `period` (optional): `all`, `today`, `week`, `month`
- `limit` (optional): number of results (default: 10)

**Response:**
```json
[
    {
        "player_name": "Player1",
        "score": 15000,
        "level": 10,
        "etfs_collected": 50,
        "max_yield": 95.2,
        "created_at": "2024-01-01T12:00:00Z"
    }
]
```

### GET `/api/game/daily-challenge`
Get today's daily challenge.

**Response:**
```json
{
    "id": 1,
    "challenge_date": "2024-01-01",
    "challenge_type": "score",
    "target_value": 8000,
    "reward_points": 500
}
```

### GET `/api/game/achievements` (Authenticated)
Get user's achievements.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
    {
        "id": "FIRST_FLIGHT",
        "name": "First Flight",
        "description": "Complete your first game",
        "points": 100,
        "unlocked": true,
        "unlockedAt": "2024-01-01T12:00:00Z"
    }
]
```

### GET `/api/game/progress` (Authenticated)
Get user's progress statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
    "id": 1,
    "user_id": 123,
    "total_score": 25000,
    "total_etfs_collected": 150,
    "max_level_reached": 8,
    "max_yield_achieved": 85.5,
    "games_played": 10,
    "daily_streak": 3,
    "last_play_date": "2024-01-01",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
}
```

### GET `/api/game/powerups` (Authenticated)
Get user's power-up inventory.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
    {
        "powerup_type": "shield",
        "quantity": 3
    }
]
```

### POST `/api/game/use-powerup` (Authenticated)
Use a power-up from inventory.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
    "powerupType": "shield"
}
```

**Response:**
```json
{
    "success": true,
    "remaining": 2
}
```

## Achievement Definitions

| Achievement | Name | Description | Points | Requirement |
|-------------|------|-------------|--------|-------------|
| `FIRST_FLIGHT` | First Flight | Complete your first game | 100 | First game |
| `YIELD_MASTER` | Yield Master | Reach 100% yield in a single game | 500 | maxYield >= 100 |
| `ETF_COLLECTOR` | ETF Collector | Collect 100 ETFs in a single game | 300 | etfsCollected >= 100 |
| `LEVEL_10` | Market Veteran | Reach level 10 | 400 | level >= 10 |
| `STREAK_7` | Week Warrior | Play 7 days in a row | 700 | daily_streak >= 7 |
| `STREAK_30` | Monthly Master | Play 30 days in a row | 3000 | daily_streak >= 30 |
| `HIGH_SCORER` | High Scorer | Score over 10,000 points | 1000 | score >= 10000 |
| `SPEED_DEMON` | Speed Demon | Collect 10 ETFs in 30 seconds | 600 | Time-based |
| `NO_CRASH` | Steady Hands | Reach level 5 without losing a life | 800 | No damage taken |
| `PORTFOLIO_BUILDER` | Portfolio Builder | Collect all 5 ETF types in one game | 400 | All types collected |

## Daily Challenge Types

| Type | Description | Target Range | Reward Range |
|------|-------------|--------------|--------------|
| `score` | Achieve a specific score | 5000-10000 | 400-600 |
| `etfs` | Collect specific number of ETFs | 30-50 | 300-400 |
| `level` | Reach a specific level | 5-10 | 400-600 |
| `yield` | Achieve a specific yield percentage | 50-100 | 500-700 |
| `no_crash` | Reach level 3 without losing a life | 3 | 700 |

## Integration Guide

### Frontend Integration

The enhanced site integration (`site-integration.js`) provides a complete API wrapper:

```javascript
// Initialize the API
const gameAPI = new GameAPI();

// Submit a score
const result = await gameAPI.submitScore({
    playerName: "Player1",
    score: 5000,
    level: 5,
    etfsCollected: 25,
    maxYield: 75.5
});

// Get leaderboard
const leaderboard = await gameAPI.getLeaderboard('all', 10);

// Get daily challenge
const challenge = await gameAPI.getDailyChallenge();

// Get achievements (authenticated)
const achievements = await gameAPI.getAchievements();

// Get progress (authenticated)
const progress = await gameAPI.getProgress();
```

### Authentication

For authenticated endpoints, include the JWT token in the Authorization header:

```javascript
const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};
```

### Achievement Notifications

Achievement notifications are automatically displayed when unlocked:

```javascript
// The API automatically shows notifications for new achievements
const result = await gameAPI.submitScore(gameData);
// If achievements were unlocked, notifications will appear
```

## Testing

Use the provided test page (`game-api-test.html`) to test all API endpoints:

1. Navigate to `/game-api-test.html`
2. Test score submission with different values
3. Test leaderboard with different periods
4. Test authenticated endpoints with a valid JWT token
5. Verify achievement unlocking with high scores

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created (score submission)
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (invalid token)
- `500` - Internal Server Error

Error responses include a descriptive message:

```json
{
    "error": "Player name, score, and level are required."
}
```

## Performance Considerations

- Database indexes are created for optimal query performance
- Leaderboard queries use efficient date filtering
- Achievement checking is optimized to avoid duplicate processing
- Player progress updates use efficient SQL operations

## Security

- All authenticated endpoints validate JWT tokens
- User data is properly isolated by user_id
- SQL injection is prevented through parameterized queries
- Input validation is performed on all endpoints

## Future Enhancements

Potential future features:
- Global leaderboards with real-time updates
- Tournament system
- Social features (friend challenges)
- Advanced power-up system
- Seasonal events and challenges
- Achievement sharing on social media 