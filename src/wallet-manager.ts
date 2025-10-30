import TonConnect, { type WalletInfo, type IStorage } from '@tonconnect/sdk';
import { createClient } from 'redis';
import { MemoryStorage, RedisStorage } from './storage.js';

type RedisClient = ReturnType<typeof createClient>;

/**
 * Manages TON Connect instances per session
 * Uses in-memory storage by default, Redis if provided
 */
export class WalletManager {
  private connectors: Map<string, TonConnect> = new Map();
  private storages: Map<string, IStorage> = new Map();
  private redisClient: RedisClient | null;

  constructor(redisClient?: RedisClient) {
    this.redisClient = redisClient || null;
  }

  /**
   * Get or create a TON Connect instance for a session
   */
  getConnector(sessionId: string, manifestUrl: string): TonConnect {
    if (!this.connectors.has(sessionId)) {
      // Use Redis if available, otherwise in-memory
      const storage = this.redisClient 
        ? new RedisStorage(this.redisClient, sessionId)
        : new MemoryStorage();
      
      this.storages.set(sessionId, storage);
      
      const connector = new TonConnect({
        manifestUrl,
        storage,
      });
      this.connectors.set(sessionId, connector);
    }
    return this.connectors.get(sessionId)!;
  }

  /**
   * Remove connector and clean up storage for a session
   */
  async removeConnector(sessionId: string): Promise<void> {
    const connector = this.connectors.get(sessionId);
    if (connector?.connected) {
      await connector.disconnect().catch(console.error);
    }
    
    const storage = this.storages.get(sessionId);
    if (storage) {
      if (storage instanceof RedisStorage) {
        await storage.cleanup().catch(console.error);
      } else if (storage instanceof MemoryStorage) {
        storage.cleanup();
      }
    }

    this.connectors.delete(sessionId);
    this.storages.delete(sessionId);
  }

  /**
   * Get all available wallets from TON Connect
   */
  async getWallets(): Promise<WalletInfo[]> {
    return await TonConnect.getWallets();
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    for (const connector of this.connectors.values()) {
      if (connector.connected) {
        cleanupPromises.push(
          connector.disconnect().catch(console.error)
        );
      }
    }

    for (const storage of this.storages.values()) {
      if (storage instanceof RedisStorage) {
        cleanupPromises.push(
          storage.cleanup().catch(console.error)
        );
      } else if (storage instanceof MemoryStorage) {
        storage.cleanup();
      }
    }

    await Promise.all(cleanupPromises);

    this.connectors.clear();
    this.storages.clear();
  }
}


