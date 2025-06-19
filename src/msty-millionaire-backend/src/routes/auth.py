from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
import uuid
import json
from src.config.database import execute_query, execute_one

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')
        full_name = data.get('fullName', '')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check if user exists
        existing_user = execute_one(
            'SELECT id FROM users WHERE email = ?', (email,)
        )
        
        if existing_user:
            return jsonify({'error': 'Email already registered'}), 400
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user
        user_id = str(uuid.uuid4())
        execute_query(
            '''INSERT INTO users (id, email, password_hash, full_name, email_verified) 
               VALUES (?, ?, ?, ?, ?)''',
            (user_id, email, password_hash, full_name, True)  # Auto-verify for demo
        )
        
        # Create access token
        access_token = create_access_token(identity=user_id)
        
        return jsonify({
            'message': 'Account created successfully',
            'token': access_token,
            'user': {
                'id': user_id,
                'email': email,
                'full_name': full_name,
                'subscription_tier': 'free'
            }
        }), 201
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'error': 'Failed to create account'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        user = execute_one(
            'SELECT id, email, password_hash, full_name, subscription_tier FROM users WHERE email = ?',
            (email,)
        )
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create access token
        access_token = create_access_token(identity=user['id'])
        
        return jsonify({
            'token': access_token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'full_name': user['full_name'],
                'subscription_tier': user['subscription_tier']
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout endpoint"""
    try:
        # In a production app, you'd invalidate the token here
        # For now, we'll just return success
        return jsonify({'message': 'Logged out successfully'})
    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information"""
    try:
        user_id = get_jwt_identity()
        
        user = execute_one(
            'SELECT id, email, full_name, subscription_tier, created_at FROM users WHERE id = ?',
            (user_id,)
        )
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': {
                'id': user['id'],
                'email': user['email'],
                'full_name': user['full_name'],
                'subscription_tier': user['subscription_tier'],
                'created_at': user['created_at']
            }
        })
        
    except Exception as e:
        print(f"Get user error: {e}")
        return jsonify({'error': 'Failed to get user information'}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        current_password = data.get('currentPassword', '')
        new_password = data.get('newPassword', '')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current and new passwords are required'}), 400
        
        # Get current user
        user = execute_one(
            'SELECT password_hash FROM users WHERE id = ?',
            (user_id,)
        )
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password
        if not bcrypt.checkpw(current_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Current password is incorrect'}), 400
        
        # Hash new password
        new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Update password
        execute_query(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_password_hash, user_id)
        )
        
        return jsonify({'message': 'Password changed successfully'})
        
    except Exception as e:
        print(f"Change password error: {e}")
        return jsonify({'error': 'Failed to change password'}), 500

