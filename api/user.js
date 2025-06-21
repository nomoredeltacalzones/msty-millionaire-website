const express = require('express');
const router = express.Router();
const db = require('./config/database');
const { authenticateToken } = require('./middleware/auth');

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.getOne(
            'SELECT id, email, full_name, subscription_tier, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { fullName } = req.body;
        if (!fullName) {
            return res.status(400).json({ error: 'Full name is required' });
        }

        const updatedUser = await db.update('users', req.user.userId, {
            full_name: fullName
        });

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                fullName: updatedUser.full_name,
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router; 
