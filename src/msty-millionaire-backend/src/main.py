import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from src.config.database import init_db
from src.routes.auth import auth_bp
from src.routes.api import api_bp
from src.routes.portfolio import portfolio_bp
from src.routes.alerts import alerts_bp
from src.routes.payments import payments_bp
from src.routes.websocket import init_socketio

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Configuration
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Tokens don't expire

# Enable CORS for all routes
CORS(app, origins="*")

# Initialize JWT
jwt = JWTManager(app)

# Initialize SocketIO
socketio = init_socketio(app)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(portfolio_bp, url_prefix='/api/portfolio')
app.register_blueprint(alerts_bp, url_prefix='/api/alerts')
app.register_blueprint(payments_bp, url_prefix='/api/payments')

# Initialize database
init_db()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

@app.route('/health')
def health_check():
    return {'status': 'healthy', 'service': 'MSTY Millionaire API'}

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    # Use SocketIO's run method instead of app.run for WebSocket support
    socketio.run(app, host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')

