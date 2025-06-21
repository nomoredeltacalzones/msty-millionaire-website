const express = require('express');
const router = express.Router();
const db = require('./config/database');
const { authenticateToken } = require('./middleware/auth');

// Get user's portfolio holdings
router.get('/holdings', authenticateToken, async (req, res) => {
    try {
        const holdings = await db.getMany(
            `SELECT 
                p.*,
                COALESCE(p.current_price, p.avg_cost) as display_price,
                (shares * COALESCE(p.current_price, p.avg_cost)) as current_value,
                (shares * avg_cost) as invested_value,
                ((shares * COALESCE(p.current_price, p.avg_cost)) - (shares * avg_cost)) as gain_loss,
                CASE 
                    WHEN (shares * avg_cost) > 0 
                    THEN (((shares * COALESCE(p.current_price, p.avg_cost)) - (shares * avg_cost)) / (shares * avg_cost) * 100)
                    ELSE 0 
                END as gain_loss_percent
             FROM portfolios p
             WHERE user_id = $1
             ORDER BY current_value DESC`,
            [req.user.userId]
        );

        res.json({ holdings });
    } catch (error) {
        console.error('Get holdings error:', error);
        res.status(500).json({ error: 'Failed to get holdings' });
    }
});

// Get portfolio summary
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await db.getOne(
            `SELECT 
                COUNT(DISTINCT ticker) as holdings_count,
                COALESCE(SUM(shares * avg_cost), 0) as total_invested,
                COALESCE(SUM(shares * COALESCE(current_price, avg_cost)), 0) as current_value,
                COALESCE(SUM(shares * COALESCE(current_price, avg_cost)) - SUM(shares * avg_cost), 0) as total_gain_loss,
                CASE 
                    WHEN SUM(shares * avg_cost) > 0 
                    THEN ((SUM(shares * COALESCE(current_price, avg_cost)) - SUM(shares * avg_cost)) / SUM(shares * avg_cost) * 100)
                    ELSE 0 
                END as total_gain_loss_percent
             FROM portfolios
             WHERE user_id = $1`,
            [req.user.userId]
        );

        res.json(summary || {
            holdings_count: 0,
            total_invested: 0,
            current_value: 0,
            total_gain_loss: 0,
            total_gain_loss_percent: 0
        });
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Failed to get portfolio summary' });
    }
});

// Get portfolio performance for different time periods
router.get('/performance', authenticateToken, async (req, res) => {
    try {
        // First, record today's snapshot
        await db.query('SELECT record_portfolio_snapshot($1)', [req.user.userId]);

        // Get performance metrics
        const performance = await db.getOne(
            `SELECT 
                current_value,
                total_invested,
                -- 1 Day
                CASE WHEN value_1d_ago IS NOT NULL 
                    THEN current_value - value_1d_ago 
                    ELSE 0 END as gain_1d,
                CASE WHEN value_1d_ago IS NOT NULL AND value_1d_ago > 0
                    THEN ((current_value - value_1d_ago) / value_1d_ago * 100)
                    ELSE 0 END as gain_1d_percent,
                -- 1 Week
                CASE WHEN value_1w_ago IS NOT NULL 
                    THEN current_value - value_1w_ago 
                    ELSE 0 END as gain_1w,
                CASE WHEN value_1w_ago IS NOT NULL AND value_1w_ago > 0
                    THEN ((current_value - value_1w_ago) / value_1w_ago * 100)
                    ELSE 0 END as gain_1w_percent,
                -- 1 Month
                CASE WHEN value_1m_ago IS NOT NULL 
                    THEN current_value - value_1m_ago 
                    ELSE 0 END as gain_1m,
                CASE WHEN value_1m_ago IS NOT NULL AND value_1m_ago > 0
                    THEN ((current_value - value_1m_ago) / value_1m_ago * 100)
                    ELSE 0 END as gain_1m_percent,
                -- 3 Months
                CASE WHEN value_3m_ago IS NOT NULL 
                    THEN current_value - value_3m_ago 
                    ELSE 0 END as gain_3m,
                CASE WHEN value_3m_ago IS NOT NULL AND value_3m_ago > 0
                    THEN ((current_value - value_3m_ago) / value_3m_ago * 100)
                    ELSE 0 END as gain_3m_percent,
                -- 6 Months
                CASE WHEN value_6m_ago IS NOT NULL 
                    THEN current_value - value_6m_ago 
                    ELSE 0 END as gain_6m,
                CASE WHEN value_6m_ago IS NOT NULL AND value_6m_ago > 0
                    THEN ((current_value - value_6m_ago) / value_6m_ago * 100)
                    ELSE 0 END as gain_6m_percent,
                -- 1 Year
                CASE WHEN value_1y_ago IS NOT NULL 
                    THEN current_value - value_1y_ago 
                    ELSE 0 END as gain_1y,
                CASE WHEN value_1y_ago IS NOT NULL AND value_1y_ago > 0
                    THEN ((current_value - value_1y_ago) / value_1y_ago * 100)
                    ELSE 0 END as gain_1y_percent,
                -- All Time
                CASE WHEN total_invested > 0 
                    THEN current_value - total_invested 
                    ELSE 0 END as gain_all,
                CASE WHEN total_invested > 0
                    THEN ((current_value - total_invested) / total_invested * 100)
                    ELSE 0 END as gain_all_percent
             FROM portfolio_performance
             WHERE user_id = $1`,
            [req.user.userId]
        );

        res.json(performance || {
            current_value: 0,
            total_invested: 0,
            gain_1d: 0, gain_1d_percent: 0,
            gain_1w: 0, gain_1w_percent: 0,
            gain_1m: 0, gain_1m_percent: 0,
            gain_3m: 0, gain_3m_percent: 0,
            gain_6m: 0, gain_6m_percent: 0,
            gain_1y: 0, gain_1y_percent: 0,
            gain_all: 0, gain_all_percent: 0
        });
    } catch (error) {
        console.error('Get performance error:', error);
        res.status(500).json({ error: 'Failed to get portfolio performance' });
    }
});

// Get portfolio history for charts
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { period = '1M' } = req.query;
        
        let daysBack = 30;
        switch(period) {
            case '1D': daysBack = 1; break;
            case '1W': daysBack = 7; break;
            case '1M': daysBack = 30; break;
            case '3M': daysBack = 90; break;
            case '6M': daysBack = 180; break;
            case '1Y': daysBack = 365; break;
            case 'ALL': daysBack = 9999; break;
        }

        const history = await db.getMany(
            `SELECT 
                date,
                total_value as value,
                total_invested as invested,
                daily_return,
                daily_return_percent
             FROM portfolio_history
             WHERE user_id = $1 
             AND date >= CURRENT_DATE - INTERVAL '${daysBack} days'
             ORDER BY date ASC`,
            [req.user.userId]
        );

        res.json({ history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get portfolio history' });
    }
});

// Add new holding
router.post('/holdings', authenticateToken, async (req, res) => {
    try {
        const { ticker, shares, avg_cost } = req.body;

        if (!ticker || !shares || !avg_cost) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get current price from proxy API
        let current_price = avg_cost;
        try {
            const stockResponse = await fetch(`http://localhost:${process.env.PORT}/api/proxy/stock/${ticker}`);
            const stockData = await stockResponse.json();
            if (stockData.price) {
                current_price = stockData.price;
            }
        } catch (err) {
            console.log('Could not fetch current price, using avg_cost');
        }

        const holding = await db.insert('portfolios', {
            user_id: req.user.userId,
            ticker: ticker.toUpperCase(),
            shares: parseFloat(shares),
            avg_cost: parseFloat(avg_cost),
            current_price: current_price
        });

        // Record new snapshot
        await db.query('SELECT record_portfolio_snapshot($1)', [req.user.userId]);

        res.status(201).json({ holding });
    } catch (error) {
        console.error('Add holding error:', error);
        if (error.message.includes('duplicate')) {
            res.status(400).json({ error: 'You already have this ticker in your portfolio' });
        } else {
            res.status(500).json({ error: 'Failed to add holding' });
        }
    }
});

// Update holding
router.put('/holdings/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { shares, avg_cost } = req.body;

        // Verify ownership
        const existing = await db.getOne(
            'SELECT * FROM portfolios WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (!existing) {
            return res.status(404).json({ error: 'Holding not found' });
        }

        const holding = await db.update('portfolios', id, {
            shares: parseFloat(shares),
            avg_cost: parseFloat(avg_cost)
        });

        // Record new snapshot
        await db.query('SELECT record_portfolio_snapshot($1)', [req.user.userId]);

        res.json({ holding });
    } catch (error) {
        console.error('Update holding error:', error);
        res.status(500).json({ error: 'Failed to update holding' });
    }
});

// Delete holding
router.delete('/holdings/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existing = await db.getOne(
            'SELECT * FROM portfolios WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (!existing) {
            return res.status(404).json({ error: 'Holding not found' });
        }

        await db.delete('portfolios', id);

        // Record new snapshot
        await db.query('SELECT record_portfolio_snapshot($1)', [req.user.userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete holding error:', error);
        res.status(500).json({ error: 'Failed to delete holding' });
    }
});

// Update all current prices
router.post('/update-prices', authenticateToken, async (req, res) => {
    try {
        const holdings = await db.getMany(
            'SELECT id, ticker FROM portfolios WHERE user_id = $1',
            [req.user.userId]
        );

        const updates = [];
        for (const holding of holdings) {
            try {
                const response = await fetch(`http://localhost:${process.env.PORT}/api/proxy/stock/${holding.ticker}`);
                const data = await response.json();
                if (data.price) {
                    updates.push(
                        db.query(
                            'UPDATE portfolios SET current_price = $1, last_updated = NOW() WHERE id = $2',
                            [data.price, holding.id]
                        )
                    );
                }
            } catch (err) {
                console.error(`Failed to update price for ${holding.ticker}`);
            }
        }

        await Promise.all(updates);
        
        // Record new snapshot
        await db.query('SELECT record_portfolio_snapshot($1)', [req.user.userId]);

        res.json({ success: true, updated: updates.length });
    } catch (error) {
        console.error('Update prices error:', error);
        res.status(500).json({ error: 'Failed to update prices' });
    }
});

module.exports = router;
