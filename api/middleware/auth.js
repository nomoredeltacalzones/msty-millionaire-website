// api/middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // No token provided
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Token is invalid or expired
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Attach user payload and token to the request object
        req.user = user; 
        req.token = token; 
        
        next();
    });
}

module.exports = { authenticateToken };
