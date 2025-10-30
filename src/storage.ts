import type { IStorage } from '@tonconnect/sdk';

/**
 * Simple in-memory storage implementation for TON Connect
 * Perfect for MCP stdio transport - lightweight and fast
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

