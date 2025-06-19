from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import uuid
from src.config.database import execute_query, execute_one

alerts_bp = Blueprint('alerts', __name__)

@alerts_bp.route('/', methods=['GET'])
@jwt_required()
def get_alerts():
    """Get user's price alerts"""
    try:
        user_id = get_jwt_identity()
        
        alerts = execute_query(
            'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        )
        
        alerts_list = []
        for alert in alerts:
            alerts_list.append({
                'id': alert['id'],
                'ticker': alert['ticker'],
                'condition': alert['condition'],
                'target_price': float(alert['target_price']),
                'is_active': bool(alert['is_active']),
                'triggered_at': alert['triggered_at'],
                'created_at': alert['created_at']
            })
        
        return jsonify({'alerts': alerts_list})
        
    except Exception as e:
        print(f"Get alerts error: {e}")
        return jsonify({'error': 'Failed to fetch alerts'}), 500

@alerts_bp.route('/', methods=['POST'])
@jwt_required()
def create_alert():
    """Create a new price alert"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        ticker = data.get('ticker', '').upper()
        condition = data.get('condition', '')  # 'above' or 'below'
        target_price = float(data.get('target_price', 0))
        
        if not ticker or condition not in ['above', 'below'] or target_price <= 0:
            return jsonify({'error': 'Invalid alert data'}), 400
        
        # Create alert
        alert_id = str(uuid.uuid4())
        execute_query(
            'INSERT INTO alerts (id, user_id, ticker, condition, target_price) VALUES (?, ?, ?, ?, ?)',
            (alert_id, user_id, ticker, condition, target_price)
        )
        
        return jsonify({
            'message': 'Alert created successfully',
            'alert': {
                'id': alert_id,
                'ticker': ticker,
                'condition': condition,
                'target_price': target_price,
                'is_active': True
            }
        }), 201
        
    except Exception as e:
        print(f"Create alert error: {e}")
        return jsonify({'error': 'Failed to create alert'}), 500

@alerts_bp.route('/<alert_id>', methods=['PUT'])
@jwt_required()
def update_alert(alert_id):
    """Update an existing alert"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Verify ownership
        alert = execute_one(
            'SELECT id FROM alerts WHERE id = ? AND user_id = ?',
            (alert_id, user_id)
        )
        
        if not alert:
            return jsonify({'error': 'Alert not found'}), 404
        
        # Update fields
        updates = []
        params = []
        
        if 'condition' in data and data['condition'] in ['above', 'below']:
            updates.append('condition = ?')
            params.append(data['condition'])
        
        if 'target_price' in data and float(data['target_price']) > 0:
            updates.append('target_price = ?')
            params.append(float(data['target_price']))
        
        if 'is_active' in data:
            updates.append('is_active = ?')
            params.append(bool(data['is_active']))
        
        if not updates:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        params.append(alert_id)
        query = f"UPDATE alerts SET {', '.join(updates)} WHERE id = ?"
        execute_query(query, params)
        
        return jsonify({'message': 'Alert updated successfully'})
        
    except Exception as e:
        print(f"Update alert error: {e}")
        return jsonify({'error': 'Failed to update alert'}), 500

@alerts_bp.route('/<alert_id>', methods=['DELETE'])
@jwt_required()
def delete_alert(alert_id):
    """Delete an alert"""
    try:
        user_id = get_jwt_identity()
        
        rows_affected = execute_query(
            'DELETE FROM alerts WHERE id = ? AND user_id = ?',
            (alert_id, user_id)
        )
        
        if rows_affected == 0:
            return jsonify({'error': 'Alert not found'}), 404
        
        return jsonify({'message': 'Alert deleted successfully'})
        
    except Exception as e:
        print(f"Delete alert error: {e}")
        return jsonify({'error': 'Failed to delete alert'}), 500

@alerts_bp.route('/check', methods=['POST'])
def check_alerts():
    """Check all active alerts against current prices (internal endpoint)"""
    try:
        # This would typically be called by a background job
        # For demo purposes, we'll allow manual triggering
        
        active_alerts = execute_query(
            'SELECT * FROM alerts WHERE is_active = ? AND triggered_at IS NULL',
            (True,)
        )
        
        triggered_count = 0
        
        for alert in active_alerts:
            # In production, you'd fetch real-time price data here
            # For demo, we'll use mock data
            current_price = get_mock_current_price(alert['ticker'])
            
            should_trigger = False
            if alert['condition'] == 'above' and current_price >= alert['target_price']:
                should_trigger = True
            elif alert['condition'] == 'below' and current_price <= alert['target_price']:
                should_trigger = True
            
            if should_trigger:
                # Mark alert as triggered
                execute_query(
                    'UPDATE alerts SET triggered_at = CURRENT_TIMESTAMP, is_active = ? WHERE id = ?',
                    (False, alert['id'])
                )
                
                # In production, you'd send notification here
                print(f"Alert triggered: {alert['ticker']} {alert['condition']} {alert['target_price']}")
                triggered_count += 1
        
        return jsonify({
            'message': f'Checked alerts, {triggered_count} triggered',
            'triggered_count': triggered_count
        })
        
    except Exception as e:
        print(f"Check alerts error: {e}")
        return jsonify({'error': 'Failed to check alerts'}), 500

def get_mock_current_price(ticker):
    """Get mock current price for demo purposes"""
    mock_prices = {
        'MSTY': 24.16,
        'TSLY': 15.89,
        'NVDY': 22.34,
        'PLTY': 18.42,
        'AMZY': 19.75,
        'GOOY': 21.33,
        'NFLY': 23.67,
        'CONY': 20.45,
        'APLY': 17.89,
        'OARK': 25.12,
        'QYLD': 16.78,
        'RYLD': 18.23,
        'XYLD': 19.45,
        'JEPI': 54.32,
        'JEPQ': 52.67
    }
    return mock_prices.get(ticker, 20.00)

