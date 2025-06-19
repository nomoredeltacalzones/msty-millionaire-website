import os
import redis
from typing import Optional, Any

# Redis configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

class RedisCache:
    def __init__(self):
        try:
            self.client = redis.from_url(REDIS_URL, decode_responses=True)
            # Test connection
            self.client.ping()
            self.connected = True
        except (redis.ConnectionError, redis.TimeoutError):
            print("Warning: Redis not available, using in-memory cache")
            self.client = None
            self.connected = False
            self._memory_cache = {}
    
    def get(self, key: str) -> Optional[str]:
        """Get value from cache"""
        if self.connected:
            try:
                return self.client.get(key)
            except:
                return None
        else:
            return self._memory_cache.get(key)
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set value in cache with optional expiration"""
        if self.connected:
            try:
                return self.client.set(key, value, ex=ex)
            except:
                return False
        else:
            self._memory_cache[key] = value
            return True
    
    def setex(self, key: str, time: int, value: str) -> bool:
        """Set value with expiration time"""
        return self.set(key, value, ex=time)
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if self.connected:
            try:
                return bool(self.client.delete(key))
            except:
                return False
        else:
            return self._memory_cache.pop(key, None) is not None
    
    def exists(self, key: str) -> bool:
        """Check if key exists"""
        if self.connected:
            try:
                return bool(self.client.exists(key))
            except:
                return False
        else:
            return key in self._memory_cache

# Global cache instance
cache = RedisCache()

