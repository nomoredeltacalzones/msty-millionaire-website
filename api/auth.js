// Backend Authentication API Routes
// Save this as: /api/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./services/email');
const { authenticateToken } = require('./middleware/auth');

// Middleware to validate email format
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user.id, 
            email: user.email,
            tier: user.subscription_tier
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Generate verification token
const generateVerificationToken = () => {
    return require('crypto').randomBytes(32).toString('hex');
};

// Register endpoint
router.post('/register', async (req, res) => {
    const { email, password, fullName } = req.body;

    try {
        // Validation
        if (!email || !password || !fullName) {
            return res.status(400).json({ 
                error: 'All fields are required' 
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        // Check if user exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ 
                error: 'Email already registered' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Generate verification token
        const verificationToken = generateVerificationToken();

        // Create user
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, verification_token, email_verified)
             VALUES ($1, $2, $3, $4, true)
             RETURNING id, email, full_name`,
            [email.toLowerCase(), passwordHash, fullName, verificationToken]
        );

        const user = result.rows[0];

        // Send verification email
        // await sendVerificationEmail(email, verificationToken);

        // Generate JWT token
        const token = generateToken(user);

        // Create session
        await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        res.status(201).json({
            message: 'Account created successfully. Please verify your email.',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                emailVerified: false
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Failed to create account' 
        });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required' 
            });
        }

        // Find user
        const result = await db.query(
            `SELECT id, email, password_hash, full_name, email_verified, 
                    subscription_tier, stripe_customer_id
             FROM users 
             WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        // Check if email is verified (optional - you can remove this check)
        // if (!user.email_verified) {
        //     return res.status(403).json({ 
        //         error: 'Please verify your email first' 
        //     });
        // }

        // Generate JWT token
        const token = generateToken(user);

        // Store session
        await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        // Log the login event
        await db.query(
            'INSERT INTO analytics_events (user_id, event_name, event_data) VALUES ($1, $2, $3)',
            [user.id, 'user_login', JSON.stringify({ ip: req.ip, userAgent: req.get('user-agent') })]
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                tier: user.subscription_tier,
                emailVerified: user.email_verified
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Login failed' 
        });
    }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Delete session
        await db.query(
            'DELETE FROM sessions WHERE token = $1',
            [req.token]
        );

        res.json({ 
            message: 'Logged out successfully' 
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ 
            error: 'Logout failed' 
        });
    }
});

// Verify email endpoint
router.get('/verify-email/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Find user with this verification token
        const result = await db.query(
            'SELECT id, email FROM users WHERE verification_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid or expired verification token' 
            });
        }

        const user = result.rows[0];

        // Update user as verified
        await db.query(
            'UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1',
            [user.id]
        );

        // Redirect to login with success message
        res.redirect('/login?verified=true');

    } catch (error) {
        console.error('Email verification error:', error);
        res.redirect('/login?error=verification-failed');
    }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ 
                error: 'Email is required' 
            });
        }

        // Find user
        const result = await db.query(
            'SELECT id, email, full_name FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            // Don't reveal if email exists or not
            return res.json({ 
                message: 'If that email exists, we sent a password reset link' 
            });
        }

        const user = result.rows[0];

        // Generate reset token
        const resetToken = generateVerificationToken();
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        // Save reset token
        await db.query(
            'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
            [resetToken, resetExpires, user.id]
        );

        // Send reset email
        await sendPasswordResetEmail(user.email, resetToken);

        res.json({ 
            message: 'If that email exists, we sent a password reset link' 
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ 
            error: 'Failed to process password reset' 
        });
    }
});

// Reset password
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        if (!token || !newPassword) {
            return res.status(400).json({ 
                error: 'Token and new password are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        // Find user with valid reset token
        const result = await db.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ 
                error: 'Invalid or expired reset token' 
            });
        }

        const user = result.rows[0];

        // Hash new password
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update password and clear reset token
        await db.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        // Invalidate all existing sessions
        await db.query(
            'DELETE FROM sessions WHERE user_id = $1',
            [user.id]
        );

        res.json({ 
            message: 'Password reset successfully. Please login with your new password.' 
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ 
            error: 'Failed to reset password' 
        });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, email, full_name, subscription_tier, email_verified, created_at
             FROM users 
             WHERE id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }

        const user = result.rows[0];

        res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            tier: user.subscription_tier,
            emailVerified: user.email_verified,
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            error: 'Failed to get user data' 
        });
    }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
    const { fullName } = req.body;

    try {
        if (!fullName) {
            return res.status(400).json({ 
                error: 'Full name is required' 
            });
        }

        await db.query(
            'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2',
            [fullName, req.user.userId]
        );

        res.json({ 
            message: 'Profile updated successfully' 
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            error: 'Failed to update profile' 
        });
    }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                error: 'Current and new password are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: 'New password must be at least 6 characters' 
            });
        }

        // Get user's current password hash
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.userId]
        );

        const user = result.rows[0];

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                error: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, req.user.userId]
        );

        res.json({ 
            message: 'Password changed successfully' 
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            error: 'Failed to change password' 
        });
    }
});

module.exports = router;
