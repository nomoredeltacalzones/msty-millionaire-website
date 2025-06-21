// Email Service
// Save this as: /api/services/email.js

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@mstymillionaire.com';
const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

async function sendVerificationEmail(email, token) {
    const verificationUrl = `${DOMAIN}/api/auth/verify-email/${token}`;
    
    const msg = {
        to: email,
        from: FROM_EMAIL,
        subject: 'Verify Your MSTY Millionaire Account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #6366f1;">Welcome to MSTY Millionaire!</h1>
                <p>Thanks for creating an account. Please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Verify Email
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${verificationUrl}</p>
                <p>This link will expire in 24 hours.</p>
                <hr style="margin: 30px 0; border: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
            </div>
        `
    };

    try {
        await sgMail.send(msg);
        console.log('Verification email sent to:', email);
    } catch (error) {
        console.error('SendGrid error:', error);
        throw new Error('Failed to send verification email');
    }
}

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${DOMAIN}/reset-password?token=${token}`;
    
    const msg = {
        to: email,
        from: FROM_EMAIL,
        subject: 'Reset Your MSTY Millionaire Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #6366f1;">Password Reset Request</h1>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${resetUrl}</p>
                <p>This link will expire in 1 hour.</p>
                <hr style="margin: 30px 0; border: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                    If you didn't request a password reset, you can safely ignore this email.
                </p>
            </div>
        `
    };

    try {
        await sgMail.send(msg);
        console.log('Password reset email sent to:', email);
    } catch (error) {
        console.error('SendGrid error:', error);
        throw new Error('Failed to send password reset email');
    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};
