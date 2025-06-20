const express = require('express');
const router = express.Router();

// A simple in-memory store for subscribed emails for demonstration purposes.
// In a real application, you would use a database (e.g., PostgreSQL, MongoDB) 
// or a third-party mailing service (e.g., Mailchimp, SendGrid).
const subscribedEmails = new Set();

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribes a user to the newsletter
 * @access  Public
 */
router.post('/subscribe', (req, res) => {
    const { email } = req.body;

    // Basic validation
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'A valid email is required.' });
    }

    const lowerCaseEmail = email.toLowerCase();

    if (subscribedEmails.has(lowerCaseEmail)) {
        return res.status(409).json({ message: 'This email is already subscribed.' });
    }

    // "Store" the email
    subscribedEmails.add(lowerCaseEmail);

    // Log to the console to demonstrate it's working
    console.log(`[Newsletter] New subscription: ${lowerCaseEmail}`);

    // In a real-world scenario, you might also trigger a confirmation email here.

    res.status(200).json({ message: 'Subscription successful!' });
});

module.exports = router; 