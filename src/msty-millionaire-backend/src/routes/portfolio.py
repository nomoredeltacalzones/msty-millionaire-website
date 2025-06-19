from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import uuid
from src.config.database import execute_query, execute_one

portfolio_bp = Blueprint('portfolio', __name__)

@portfolio_bp.route('/holdings', methods=['GET'])
@jwt_required()
def get_holdings():
    """Get user's portfolio holdings"""
    try:
        user_id = get_jwt_identity()
        
        holdings = execute_query(
            '''SELECT h.*, 
               (SELECT price FROM stock_cache WHERE ticker = h.ticker ORDER BY updated_at DESC LIMIT 1) as current_price
               FROM holdings h 
               WHERE h.user_id = ? 
               ORDER BY h.created_at DESC''',
            (user_id,)
        )
        
        # Calculate portfolio metrics
        total_value = 0
        total_cost = 0
        holdings_list = []
        
        for holding in holdings:
            current_price = holding.get('current_price') or holding['avg_cost']
            market_value = float(holding['shares']) * float(current_price)
            cost_basis = float(holding['shares']) * float(holding['avg_cost'])
            gain_loss = market_value - cost_basis
            gain_loss_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0
            
            holdings_list.append({
                'id': holding['id'],
                'ticker': holding['ticker'],
                'shares': float(holding['shares']),
                'avg_cost': float(holding['avg_cost']),
                'current_price': float(current_price),
                'market_value': market_value,
                'cost_basis': cost_basis,
                'gain_loss': gain_loss,
                'gain_loss_percent': gain_loss_percent,
                'created_at': holding['created_at']
            })
            
            total_value += market_value
            total_cost += cost_basis
        
        portfolio_metrics = {
            'total_value': total_value,
            'total_cost': total_cost,
            'total_gain_loss': total_value - total_cost,
            'total_gain_loss_percent': ((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0,
            'holdings_count': len(holdings_list)
        }
        
        return jsonify({
            'holdings': holdings_list,
            'metrics': portfolio_metrics
        })
        
    except Exception as e:
        print(f"Get holdings error: {e}")
        return jsonify({'error': 'Failed to fetch holdings'}), 500

@portfolio_bp.route('/holdings', methods=['POST'])
@jwt_required()
def add_holding():
    """Add a new holding to portfolio"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        ticker = data.get('ticker', '').upper()
        shares = float(data.get('shares', 0))
        avg_cost = float(data.get('avg_cost', 0))
        
        if not ticker or shares <= 0 or avg_cost <= 0:
            return jsonify({'error': 'Invalid holding data'}), 400
        
        # Check if holding already exists
        existing = execute_one(
            'SELECT id, shares, avg_cost FROM holdings WHERE user_id = ? AND ticker = ?',
            (user_id, ticker)
        )
        
        if existing:
            # Update existing holding (average cost calculation)
            old_shares = float(existing['shares'])
            old_cost = float(existing['avg_cost'])
            
            new_total_shares = old_shares + shares
            new_avg_cost = ((old_shares * old_cost) + (shares * avg_cost)) / new_total_shares
            
            execute_query(
                'UPDATE holdings SET shares = ?, avg_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (new_total_shares, new_avg_cost, existing['id'])
            )
            
            return jsonify({
                'message': 'Holding updated successfully',
                'holding': {
                    'ticker': ticker,
                    'shares': new_total_shares,
                    'avg_cost': new_avg_cost
                }
            })
        else:
            # Create new holding
            holding_id = str(uuid.uuid4())
            execute_query(
                'INSERT INTO holdings (id, user_id, ticker, shares, avg_cost) VALUES (?, ?, ?, ?, ?)',
                (holding_id, user_id, ticker, shares, avg_cost)
            )
            
            return jsonify({
                'message': 'Holding added successfully',
                'holding': {
                    'id': holding_id,
                    'ticker': ticker,
                    'shares': shares,
                    'avg_cost': avg_cost
                }
            }), 201
        
    except Exception as e:
        print(f"Add holding error: {e}")
        return jsonify({'error': 'Failed to add holding'}), 500

@portfolio_bp.route('/holdings/<holding_id>', methods=['PUT'])
@jwt_required()
def update_holding(holding_id):
    """Update an existing holding"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        shares = float(data.get('shares', 0))
        avg_cost = float(data.get('avg_cost', 0))
        
        if shares <= 0 or avg_cost <= 0:
            return jsonify({'error': 'Invalid holding data'}), 400
        
        # Verify ownership
        holding = execute_one(
            'SELECT id FROM holdings WHERE id = ? AND user_id = ?',
            (holding_id, user_id)
        )
        
        if not holding:
            return jsonify({'error': 'Holding not found'}), 404
        
        # Update holding
        execute_query(
            'UPDATE holdings SET shares = ?, avg_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (shares, avg_cost, holding_id)
        )
        
        return jsonify({'message': 'Holding updated successfully'})
        
    except Exception as e:
        print(f"Update holding error: {e}")
        return jsonify({'error': 'Failed to update holding'}), 500

@portfolio_bp.route('/holdings/<holding_id>', methods=['DELETE'])
@jwt_required()
def delete_holding(holding_id):
    """Delete a holding from portfolio"""
    try:
        user_id = get_jwt_identity()
        
        # Verify ownership and delete
        rows_affected = execute_query(
            'DELETE FROM holdings WHERE id = ? AND user_id = ?',
            (holding_id, user_id)
        )
        
        if rows_affected == 0:
            return jsonify({'error': 'Holding not found'}), 404
        
        return jsonify({'message': 'Holding deleted successfully'})
        
    except Exception as e:
        print(f"Delete holding error: {e}")
        return jsonify({'error': 'Failed to delete holding'}), 500

@portfolio_bp.route('/watchlist', methods=['GET'])
@jwt_required()
def get_watchlist():
    """Get user's watchlist"""
    try:
        user_id = get_jwt_identity()
        
        watchlist = execute_query(
            'SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        )
        
        watchlist_items = []
        for item in watchlist:
            watchlist_items.append({
                'id': item['id'],
                'ticker': item['ticker'],
                'target_price': float(item['target_price']) if item['target_price'] else None,
                'notes': item['notes'],
                'created_at': item['created_at']
            })
        
        return jsonify({'watchlist': watchlist_items})
        
    except Exception as e:
        print(f"Get watchlist error: {e}")
        return jsonify({'error': 'Failed to fetch watchlist'}), 500

@portfolio_bp.route('/watchlist', methods=['POST'])
@jwt_required()
def add_to_watchlist():
    """Add ticker to watchlist"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        ticker = data.get('ticker', '').upper()
        target_price = data.get('target_price')
        notes = data.get('notes', '')
        
        if not ticker:
            return jsonify({'error': 'Ticker is required'}), 400
        
        # Check if already in watchlist
        existing = execute_one(
            'SELECT id FROM watchlist WHERE user_id = ? AND ticker = ?',
            (user_id, ticker)
        )
        
        if existing:
            return jsonify({'error': 'Ticker already in watchlist'}), 400
        
        # Add to watchlist
        watchlist_id = str(uuid.uuid4())
        execute_query(
            'INSERT INTO watchlist (id, user_id, ticker, target_price, notes) VALUES (?, ?, ?, ?, ?)',
            (watchlist_id, user_id, ticker, target_price, notes)
        )
        
        return jsonify({
            'message': 'Added to watchlist successfully',
            'item': {
                'id': watchlist_id,
                'ticker': ticker,
                'target_price': target_price,
                'notes': notes
            }
        }), 201
        
    except Exception as e:
        print(f"Add to watchlist error: {e}")
        return jsonify({'error': 'Failed to add to watchlist'}), 500

@portfolio_bp.route('/watchlist/<item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_watchlist(item_id):
    """Remove ticker from watchlist"""
    try:
        user_id = get_jwt_identity()
        
        rows_affected = execute_query(
            'DELETE FROM watchlist WHERE id = ? AND user_id = ?',
            (item_id, user_id)
        )
        
        if rows_affected == 0:
            return jsonify({'error': 'Watchlist item not found'}), 404
        
        return jsonify({'message': 'Removed from watchlist successfully'})
        
    except Exception as e:
        print(f"Remove from watchlist error: {e}")
        return jsonify({'error': 'Failed to remove from watchlist'}), 500

