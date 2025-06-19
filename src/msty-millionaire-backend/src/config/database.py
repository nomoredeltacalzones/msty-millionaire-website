import os
import psycopg2
from psycopg2.extras import RealDictCursor
import sqlite3
from contextlib import contextmanager

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL')
USE_POSTGRES = DATABASE_URL and DATABASE_URL.startswith('postgresql')

def get_db_connection():
    """Get database connection based on configuration"""
    if USE_POSTGRES:
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    else:
        # Fallback to SQLite for development
        db_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'app.db')
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """Initialize database with required tables"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        if USE_POSTGRES:
            # PostgreSQL schema
            cursor.execute("""
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
                
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    subscription_tier VARCHAR(20) DEFAULT 'free',
                    subscription_expires_at TIMESTAMP,
                    email_verified BOOLEAN DEFAULT false,
                    verification_token VARCHAR(255)
                );
                
                CREATE TABLE IF NOT EXISTS holdings (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    ticker VARCHAR(10) NOT NULL,
                    shares DECIMAL(10,2) NOT NULL,
                    avg_cost DECIMAL(10,2) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id, ticker)
                );
                
                CREATE TABLE IF NOT EXISTS watchlist (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    ticker VARCHAR(10) NOT NULL,
                    target_price DECIMAL(10,2),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id, ticker)
                );
                
                CREATE TABLE IF NOT EXISTS alerts (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    ticker VARCHAR(10) NOT NULL,
                    condition VARCHAR(10) NOT NULL,
                    target_price DECIMAL(10,2) NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    triggered_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS distributions (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    ticker VARCHAR(10) NOT NULL,
                    ex_date DATE NOT NULL,
                    pay_date DATE NOT NULL,
                    amount DECIMAL(10,4) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(ticker, ex_date)
                );
                
                CREATE TABLE IF NOT EXISTS sessions (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    token VARCHAR(255) UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)
        else:
            # SQLite schema for development
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    subscription_tier TEXT DEFAULT 'free',
                    subscription_expires_at TIMESTAMP,
                    email_verified BOOLEAN DEFAULT 0,
                    verification_token TEXT
                );
                
                CREATE TABLE IF NOT EXISTS holdings (
                    id TEXT PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    ticker TEXT NOT NULL,
                    shares REAL NOT NULL,
                    avg_cost REAL NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, ticker)
                );
                
                CREATE TABLE IF NOT EXISTS watchlist (
                    id TEXT PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    ticker TEXT NOT NULL,
                    target_price REAL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, ticker)
                );
                
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    ticker TEXT NOT NULL,
                    condition TEXT NOT NULL,
                    target_price REAL NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    triggered_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS distributions (
                    id TEXT PRIMARY KEY,
                    ticker TEXT NOT NULL,
                    ex_date DATE NOT NULL,
                    pay_date DATE NOT NULL,
                    amount REAL NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ticker, ex_date)
                );
                
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

def execute_query(query, params=None):
    """Execute a query and return results"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        
        if query.strip().upper().startswith('SELECT'):
            return cursor.fetchall()
        else:
            return cursor.rowcount

def execute_one(query, params=None):
    """Execute a query and return one result"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        return cursor.fetchone()

