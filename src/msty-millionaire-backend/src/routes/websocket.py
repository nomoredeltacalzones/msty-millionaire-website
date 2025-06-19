from flask import Blueprint
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import jwt_required, get_jwt_identity, decode_token
import json
import threading
import time
from datetime import datetime
from src.routes.api import fetch_stock_data

# WebSocket blueprint
websocket_bp = Blueprint('websocket', __name__)

# Global SocketIO instance (will be initialized in main.py)
socketio = None

# Active subscriptions: {room_name: {user_id: socket_id}}
active_subscriptions = {}

# Background task for real-time data updates
background_thread = None
background_thread_started = False

def init_socketio(app):
    """Initialize SocketIO with the Flask app"""
    global socketio
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
    
    # Register event handlers
    @socketio.on('connect')
    def handle_connect(auth):
        """Handle client connection"""
        try:
            # Verify JWT token
            token = auth.get('token') if auth else None
            if not token:
                print("WebSocket connection rejected: No token provided")
                return False
            
            # Decode token to get user ID
            try:
                decoded_token = decode_token(token)
                user_id = decoded_token['sub']
                print(f"WebSocket connected: User {user_id}")
                
                # Store user info in session
                from flask import session
                session['user_id'] = user_id
                
                emit('connected', {'status': 'success', 'message': 'Connected to real-time data feed'})
                
                # Start background thread if not already running
                global background_thread_started
                if not background_thread_started:
                    start_background_thread()
                
                return True
                
            except Exception as e:
                print(f"WebSocket token validation failed: {e}")
                return False
                
        except Exception as e:
            print(f"WebSocket connection error: {e}")
            return False
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        try:
            from flask import session
            user_id = session.get('user_id')
            if user_id:
                # Remove user from all subscriptions
                for room_name in list(active_subscriptions.keys()):
                    if user_id in active_subscriptions[room_name]:
                        del active_subscriptions[room_name][user_id]
                        if not active_subscriptions[room_name]:
                            del active_subscriptions[room_name]
                
                print(f"WebSocket disconnected: User {user_id}")
        except Exception as e:
            print(f"WebSocket disconnect error: {e}")
    
    @socketio.on('subscribe')
    def handle_subscribe(data):
        """Handle subscription to ticker updates"""
        try:
            from flask import session
            user_id = session.get('user_id')
            if not user_id:
                emit('error', {'message': 'Authentication required'})
                return
            
            ticker = data.get('ticker', '').upper()
            if not ticker:
                emit('error', {'message': 'Ticker is required'})
                return
            
            room_name = f"ticker_{ticker}"
            
            # Join the room
            join_room(room_name)
            
            # Track subscription
            if room_name not in active_subscriptions:
                active_subscriptions[room_name] = {}
            active_subscriptions[room_name][user_id] = True
            
            print(f"User {user_id} subscribed to {ticker}")
            emit('subscribed', {'ticker': ticker, 'status': 'success'})
            
            # Send current data immediately
            try:
                current_data = fetch_stock_data(ticker)
                emit('ticker_update', {
                    'ticker': ticker,
                    'data': current_data,
                    'timestamp': datetime.now().isoformat()
                }, room=room_name)
            except Exception as e:
                print(f"Error sending current data for {ticker}: {e}")
                
        except Exception as e:
            print(f"Subscribe error: {e}")
            emit('error', {'message': 'Subscription failed'})
    
    @socketio.on('unsubscribe')
    def handle_unsubscribe(data):
        """Handle unsubscription from ticker updates"""
        try:
            from flask import session
            user_id = session.get('user_id')
            if not user_id:
                return
            
            ticker = data.get('ticker', '').upper()
            if not ticker:
                return
            
            room_name = f"ticker_{ticker}"
            
            # Leave the room
            leave_room(room_name)
            
            # Remove from subscriptions
            if room_name in active_subscriptions and user_id in active_subscriptions[room_name]:
                del active_subscriptions[room_name][user_id]
                if not active_subscriptions[room_name]:
                    del active_subscriptions[room_name]
            
            print(f"User {user_id} unsubscribed from {ticker}")
            emit('unsubscribed', {'ticker': ticker, 'status': 'success'})
            
        except Exception as e:
            print(f"Unsubscribe error: {e}")
    
    return socketio

def start_background_thread():
    """Start the background thread for real-time data updates"""
    global background_thread, background_thread_started
    
    if not background_thread_started:
        background_thread_started = True
        background_thread = threading.Thread(target=background_task)
        background_thread.daemon = True
        background_thread.start()
        print("Background thread started for real-time data updates")

def background_task():
    """Background task to fetch and broadcast real-time data"""
    while True:
        try:
            if not active_subscriptions:
                time.sleep(5)  # No active subscriptions, wait longer
                continue
            
            # Get all unique tickers from active subscriptions
            tickers = set()
            for room_name in active_subscriptions.keys():
                if room_name.startswith('ticker_'):
                    ticker = room_name.replace('ticker_', '')
                    tickers.add(ticker)
            
            # Fetch data for all subscribed tickers
            for ticker in tickers:
                try:
                    room_name = f"ticker_{ticker}"
                    if room_name in active_subscriptions and active_subscriptions[room_name]:
                        # Fetch current data
                        data = fetch_stock_data(ticker)
                        
                        # Broadcast to all subscribers in the room
                        socketio.emit('ticker_update', {
                            'ticker': ticker,
                            'data': data,
                            'timestamp': datetime.now().isoformat()
                        }, room=room_name)
                        
                except Exception as e:
                    print(f"Error updating {ticker}: {e}")
            
            # Wait 30 seconds before next update
            time.sleep(30)
            
        except Exception as e:
            print(f"Background task error: {e}")
            time.sleep(10)

def broadcast_price_alert(user_id, ticker, condition, target_price, current_price):
    """Broadcast price alert to specific user"""
    try:
        if socketio:
            socketio.emit('price_alert', {
                'ticker': ticker,
                'condition': condition,
                'target_price': target_price,
                'current_price': current_price,
                'message': f"{ticker} has {condition} ${target_price}",
                'timestamp': datetime.now().isoformat()
            }, room=f"user_{user_id}")
    except Exception as e:
        print(f"Error broadcasting price alert: {e}")

def broadcast_market_update(data):
    """Broadcast general market updates to all connected users"""
    try:
        if socketio:
            socketio.emit('market_update', {
                'data': data,
                'timestamp': datetime.now().isoformat()
            }, broadcast=True)
    except Exception as e:
        print(f"Error broadcasting market update: {e}")

# Export the init function
__all__ = ['init_socketio', 'broadcast_price_alert', 'broadcast_market_update']

