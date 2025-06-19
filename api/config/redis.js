// api/config/redis.js
const redis = require('redis');

let client = null;

// Only create Redis client if REDIS_URL is provided
if (process.env.REDIS_URL) {
    try {
        client = redis.createClient({
            url: process.env.REDIS_URL
        });

        client.on('error', (err) => {
            console.error('Redis Client Error', err);
        });

        client.on('connect', () => {
            console.log('Redis Client Connected');
        });

        // Connect to Redis
        (async () => {
            try {
                await client.connect();
            } catch (error) {
                console.log('Redis connection failed, using memory cache instead');
                client = null;
            }
        })();
    } catch (error) {
        console.log('Redis not configured, using memory cache');
        client = null;
    }
} else {
    console.log('REDIS_URL not found, using memory cache');
}

module.exports = client;
