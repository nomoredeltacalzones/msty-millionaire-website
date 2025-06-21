// api/game.js
const express = require('express');
const router = express.Router();
const db = require('./config/database');

// POST /api/game/score
// Saves a new score to the leaderboard
router.post('/score', async (req, res) => {
    const { playerName, score, level } = req.body;

    if (!playerName || typeof score === 'undefined' || typeof level === 'undefined') {
        return res.status(400).json({ error: 'Player name, score, and level are required.' });
    }

    try {
        const query = `
            INSERT INTO high_scores (player_name, score, level)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const values = [playerName, score, level];
        const result = await db.query(query, values);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/game/leaderboard
// Retrieves the top 10 scores
router.get('/leaderboard', async (req, res) => {
    try {
        const query = `
            SELECT player_name, score, level
            FROM high_scores
            ORDER BY score DESC, created_at DESC
            LIMIT 10;
        `;
        const result = await db.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 