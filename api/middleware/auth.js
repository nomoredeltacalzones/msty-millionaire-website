// api/middleware/auth.js
// Temporary auth middleware - replace with real JWT auth later

function authenticateToken(req, res, next) {
    // For testing, just set a dummy user
    // In production, this should validate JWT tokens
    req.user = {
        userId: 1, // Default test user ID
        email: 'test@example.com'
    };
    
    next();
}

module.exports = { authenticateToken };
