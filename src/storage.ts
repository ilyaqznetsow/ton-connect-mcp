import type { IStorage } from '@tonconnect/sdk';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

/**
 * Simple in-memory storage implementation for TON Connect
 * Suitable for single-user scenarios and development
 */
export class MemoryStorage implements IStorage {
  private storage: Map<string, string> = new Map();

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) ?? null;
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  cleanup(): void {
    this.storage.clear();
  }
}

/**
 * Redis storage implementation for TON Connect
 * Use this for production deployments that need persistence across restarts
 */
export class RedisStorage implements IStorage {
  private readonly prefix: string;
  private readonly ttl: number;
  private client: RedisClient;

  constructor(client: RedisClient, sessionId: string, ttl: number = 86400) {
    this.client = client;
    this.prefix = `tonconnect:${sessionId}:`;
    this.ttl = ttl;
  }

  async setItem(key: string, value: string): Promise<void> {
    const redisKey = this.prefix + key;
    await this.client.set(redisKey, value, { EX: this.ttl });
  }

  async getItem(key: string): Promise<string | null> {
    const redisKey = this.prefix + key;
    return await this.client.get(redisKey);
  }

  async removeItem(key: string): Promise<void> {
    const redisKey = this.prefix + key;
    await this.client.del(redisKey);
  }

  async cleanup(): Promise<void> {
    const pattern = this.prefix + '*';
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

/**
 * Create and connect to Redis client (optional)
 */
export async function createRedisClient(url?: string): Promise<RedisClient> {
  const client = createClient({
    url: url || process.env.REDIS_URL || 'redis://localhost:6379',
  });

  client.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  await client.connect();
  return client;
}

