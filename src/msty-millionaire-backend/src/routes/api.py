from flask import Blueprint, request, jsonify
import requests
import os
import json
from datetime import datetime, timedelta
from src.config.redis_cache import cache

api_bp = Blueprint('api', __name__)

# Rate limiting decorator
def rate_limit(max_requests=60, window=60):
    def decorator(f):
        def wrapper(*args, **kwargs):
            # Simple rate limiting using Redis/memory
            client_ip = request.remote_addr
            key = f"rate_limit:{client_ip}:{f.__name__}"
            
            current_requests = cache.get(key)
            if current_requests is None:
                cache.setex(key, window, "1")
                return f(*args, **kwargs)
            
            if int(current_requests) >= max_requests:
                return jsonify({'error': 'Rate limit exceeded'}), 429
            
            cache.set(key, str(int(current_requests) + 1), ex=window)
            return f(*args, **kwargs)
        
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

@api_bp.route('/stock/<ticker>', methods=['GET'])
@rate_limit(max_requests=60, window=60)
def get_stock_data(ticker):
    """Get stock data for a specific ticker"""
    try:
        ticker = ticker.upper()
        
        # Check cache first
        cache_key = f"stock:{ticker}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return jsonify(json.loads(cached_data))
        
        # Fetch from API
        data = fetch_stock_data(ticker)
        
        # Cache for 1 minute
        cache.setex(cache_key, 60, json.dumps(data))
        
        return jsonify(data)
        
    except Exception as e:
        print(f"Stock fetch error: {e}")
        return jsonify({'error': 'Failed to fetch stock data'}), 500

@api_bp.route('/stocks/batch', methods=['POST'])
@rate_limit(max_requests=30, window=60)
def get_batch_stock_data():
    """Get stock data for multiple tickers"""
    try:
        data = request.get_json()
        tickers = data.get('tickers', [])
        
        if not isinstance(tickers, list) or len(tickers) > 50:
            return jsonify({'error': 'Invalid request - max 50 tickers'}), 400
        
        results = []
        for ticker in tickers:
            try:
                stock_data = fetch_stock_data(ticker.upper())
                results.append(stock_data)
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
                results.append({
                    'ticker': ticker.upper(),
                    'error': 'Failed to fetch data'
                })
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Batch fetch error: {e}")
        return jsonify({'error': 'Failed to fetch batch data'}), 500

@api_bp.route('/yieldmax/yields', methods=['GET'])
@rate_limit(max_requests=30, window=60)
def get_yieldmax_yields():
    """Get current yields for YieldMax ETFs"""
    try:
        # Check cache first
        cache_key = "yieldmax:yields"
        cached_data = cache.get(cache_key)
        if cached_data:
            return jsonify(json.loads(cached_data))
        
        # YieldMax ETF tickers
        yieldmax_tickers = [
            'MSTY', 'TSLY', 'NVDY', 'PLTY', 'AMZY', 'GOOY', 'NFLY', 'CONY',
            'APLY', 'OARK', 'QYLD', 'RYLD', 'XYLD', 'JEPI', 'JEPQ'
        ]
        
        yields_data = []
        for ticker in yieldmax_tickers:
            try:
                stock_data = fetch_stock_data(ticker)
                # Calculate approximate yield (this would be more sophisticated in production)
                yield_estimate = calculate_yield_estimate(ticker, stock_data)
                
                yields_data.append({
                    'ticker': ticker,
                    'price': stock_data.get('price'),
                    'yield': yield_estimate,
                    'change': stock_data.get('change'),
                    'changePercent': stock_data.get('changePercent')
                })
            except Exception as e:
                print(f"Error fetching yield for {ticker}: {e}")
        
        # Cache for 5 minutes
        cache.setex(cache_key, 300, json.dumps(yields_data))
        
        return jsonify(yields_data)
        
    except Exception as e:
        print(f"YieldMax yields error: {e}")
        return jsonify({'error': 'Failed to fetch yields'}), 500

@api_bp.route('/distributions/<month>', methods=['GET'])
@rate_limit(max_requests=30, window=60)
def get_distributions(month):
    """Get distribution calendar for a specific month"""
    try:
        # This would typically come from a database or external API
        # For demo purposes, we'll return mock data
        distributions = get_mock_distributions(month)
        return jsonify(distributions)
        
    except Exception as e:
        print(f"Distributions error: {e}")
        return jsonify({'error': 'Failed to fetch distributions'}), 500

def fetch_stock_data(ticker):
    """Fetch stock data from external APIs"""
    # Try IEX Cloud first
    iex_key = os.getenv('IEX_CLOUD_KEY')
    if iex_key and iex_key != 'pk_your_iex_key':
        try:
            response = requests.get(
                f'https://cloud.iexapis.com/stable/stock/{ticker}/quote',
                params={'token': iex_key},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    'ticker': ticker,
                    'price': data.get('latestPrice'),
                    'change': data.get('change'),
                    'changePercent': data.get('changePercent'),
                    'volume': data.get('volume'),
                    'marketCap': data.get('marketCap'),
                    'high': data.get('high'),
                    'low': data.get('low'),
                    'previousClose': data.get('previousClose'),
                    'timestamp': datetime.now().isoformat()
                }
        except Exception as e:
            print(f"IEX Cloud error: {e}")
    
    # Fallback to Finnhub
    finnhub_key = os.getenv('FINNHUB_KEY')
    if finnhub_key and finnhub_key != 'your_finnhub_key':
        try:
            response = requests.get(
                'https://finnhub.io/api/v1/quote',
                params={'symbol': ticker, 'token': finnhub_key},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    'ticker': ticker,
                    'price': data.get('c'),
                    'change': data.get('d'),
                    'changePercent': data.get('dp'),
                    'high': data.get('h'),
                    'low': data.get('l'),
                    'previousClose': data.get('pc'),
                    'timestamp': datetime.now().isoformat()
                }
        except Exception as e:
            print(f"Finnhub error: {e}")
    
    # Return mock data if no API keys are configured
    return get_mock_stock_data(ticker)

def calculate_yield_estimate(ticker, stock_data):
    """Calculate estimated yield for YieldMax ETFs"""
    # Mock yield calculations - in production this would use real distribution data
    yield_estimates = {
        'MSTY': 90.27,
        'TSLY': 67.43,
        'NVDY': 85.21,
        'PLTY': 139.94,
        'AMZY': 45.67,
        'GOOY': 78.32,
        'NFLY': 92.15,
        'CONY': 56.89,
        'APLY': 123.45,
        'OARK': 34.56,
        'QYLD': 11.23,
        'RYLD': 9.87,
        'XYLD': 10.45,
        'JEPI': 8.76,
        'JEPQ': 9.12
    }
    return yield_estimates.get(ticker, 0.0)

def get_mock_stock_data(ticker):
    """Return mock stock data for demo purposes"""
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
    
    base_price = mock_prices.get(ticker, 20.00)
    change = round((base_price * 0.02) - 0.01, 2)  # Random small change
    
    return {
        'ticker': ticker,
        'price': base_price,
        'change': change,
        'changePercent': round((change / base_price) * 100, 2),
        'volume': 1000000,
        'high': round(base_price * 1.02, 2),
        'low': round(base_price * 0.98, 2),
        'previousClose': round(base_price - change, 2),
        'timestamp': datetime.now().isoformat()
    }

def get_mock_distributions(month):
    """Return mock distribution data"""
    return [
        {
            'ticker': 'MSTY',
            'ex_date': f'2025-{month}-15',
            'pay_date': f'2025-{month}-20',
            'amount': 1.85,
            'type': 'Monthly'
        },
        {
            'ticker': 'TSLY',
            'ex_date': f'2025-{month}-15',
            'pay_date': f'2025-{month}-20',
            'amount': 0.89,
            'type': 'Monthly'
        },
        {
            'ticker': 'NVDY',
            'ex_date': f'2025-{month}-15',
            'pay_date': f'2025-{month}-20',
            'amount': 1.58,
            'type': 'Monthly'
        }
    ]

