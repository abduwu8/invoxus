const { createClient } = require('redis');

let redisClient = null;
let isRedisAvailable = false;

async function getRedisClient() {
  // If Redis is not configured, return null (graceful degradation)
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('ℹ️  Redis not configured (REDIS_URL missing). Running without cache.');
    return null;
  }

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('❌ Redis connection failed after 3 retries. Running without cache.');
            isRedisAvailable = false;
            return new Error('Redis unavailable');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('⚠️  Redis error:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      isRedisAvailable = true;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    isRedisAvailable = false;
    return null;
  }
}

// Cache helper functions with graceful degradation
async function getCached(key) {
  if (!isRedisAvailable) return null;
  
  try {
    const client = await getRedisClient();
    if (!client) return null;
    
    const cached = await client.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Redis get error:', error.message);
    return null;
  }
}

async function setCached(key, value, expirySeconds = 300) {
  if (!isRedisAvailable) return false;
  
  try {
    const client = await getRedisClient();
    if (!client) return false;
    
    await client.setEx(key, expirySeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis set error:', error.message);
    return false;
  }
}

async function deleteCached(key) {
  if (!isRedisAvailable) return false;
  
  try {
    const client = await getRedisClient();
    if (!client) return false;
    
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error.message);
    return false;
  }
}

module.exports = {
  getRedisClient,
  getCached,
  setCached,
  deleteCached
};

