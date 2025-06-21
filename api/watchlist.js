const express = require('express');
const router = express.Router();
const db = require('./config/database');
const { authenticateToken } = require('./middleware/auth');

// Get user's watchlist
router.get('/', authenticateToken, async (req, res) => {
    try {
        const watchlist = await db.getMany(
            'SELECT ticker, notes, created_at FROM watchlists WHERE user_id = $1 ORDER BY ticker ASC',
            [req.user.userId]
        );
        res.json(watchlist);
    } catch (error) {
        console.error('Get watchlist error:', error);
        res.status(500).json({ error: 'Failed to retrieve watchlist' });
    }
});

// Add ticker to watchlist
router.post('/', authenticateToken, async (req, res) => {
    const { ticker } = req.body;
    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
    }

    try {
        const newEntry = await db.insert('watchlists', {
            user_id: req.user.userId,
            ticker: ticker.toUpperCase()
        });
        res.status(201).json(newEntry);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'Ticker is already in your watchlist' });
        }
        console.error('Add to watchlist error:', error);
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});

// Remove ticker from watchlist
router.delete('/:ticker', authenticateToken, async (req, res) => {
    const { ticker } = req.params;
    try {
        const result = await db.query(
            'DELETE FROM watchlists WHERE user_id = $1 AND ticker = $2',
            [req.user.userId, ticker.toUpperCase()]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ticker not found in watchlist' });
        }

        res.status(204).send(); // No content
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

module.exports = router; 
