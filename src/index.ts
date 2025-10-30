#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import TonConnect, { UserRejectsError, isWalletInfoRemote, isWalletInfoInjectable } from '@tonconnect/sdk';
import { WalletManager } from './wallet-manager.js';
import { createRedisClient } from './storage.js';

const DEFAULT_MANIFEST_URL = 'https://app.palette.finance/tonconnect-manifest.json';
const MANIFEST_URL = process.env.TONCONNECT_MANIFEST_URL || DEFAULT_MANIFEST_URL;
const REDIS_URL = process.env.REDIS_URL;
const PORT = parseInt(process.env.PORT || '3000');

// Initialize wallet manager (with optional Redis)
let redisClient: Awaited<ReturnType<typeof createRedisClient>> | null = null;
let storageType = 'in-memory';

if (REDIS_URL) {
  try {
    redisClient = await createRedisClient(REDIS_URL);
    storageType = 'Redis';
    console.log('✓ Redis connected');
  } catch (error) {
    console.warn('⚠ Redis connection failed, falling back to in-memory storage');
    console.warn('  Error:', (error as Error).message);
  }
}

const walletManager = new WalletManager(redisClient ?? undefined);

// Store transports by session ID
const sessionTransports: Map<string, StreamableHTTPServerTransport> = new Map();

// Create MCP server
const server = new McpServer({
  name: 'ton-connect-mcp',
  version: '1.0.0',
});

/**
 * Get session ID from current request context
 */
function getCurrentSessionId(): string {
  const sessionId = (globalThis as any).__mcpSessionId;
  if (typeof sessionId === 'string') {
    return sessionId;
  }
  throw new Error('No active session found. This tool requires an active MCP session.');
}

/**
 * Get connector for current session
 */
function getConnectorForSession(sessionId: string): TonConnect {
  return walletManager.getConnector(sessionId, MANIFEST_URL!);
}

/**
 * Tool: Get wallet connection status
 */
server.registerTool(
  'get_wallet_status',
  {
    title: 'Get Wallet Status',
    description: 'Check if a wallet is connected and get wallet information for the current session',
    inputSchema: {},
  },
  async () => {
    try {
      const sessionId = getCurrentSessionId();
      const connector = getConnectorForSession(sessionId);
      
      if (!connector.connected) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Wallet not connected. Use connect_wallet to establish a connection first.' 
          }],
          isError: true,
        };
      }

      const account = connector.wallet?.account;
      if (!account) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Wallet connected but account information unavailable.' 
          }],
          isError: true,
        };
      }

      const output = {
        connected: true,
        address: account.address,
        chain: account.chain,
        wallet: connector.wallet?.device?.appName || 'Unknown',
        publicKey: account.publicKey,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: List available wallets
 */
server.registerTool(
  'list_wallets',
  {
    title: 'List Available Wallets',
    description: 'Get list of all available TON wallets that can be connected via TON Connect protocol',
    inputSchema: {},
  },
  async () => {
    try {
      const wallets = await walletManager.getWallets();
      
      if (!wallets || wallets.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: 'No wallets available. Unable to fetch wallet list from TON Connect.' 
          }],
          isError: true,
        };
      }

      const walletList = wallets.map((w) => {
        const baseInfo = {
          name: w.name,
          imageUrl: w.imageUrl,
          appName: w.appName,
        };

        if (isWalletInfoRemote(w)) {
          return {
            ...baseInfo,
            type: 'remote',
            universalLink: w.universalLink,
            deepLink: w.deepLink,
            bridgeUrl: w.bridgeUrl,
          };
        }
        
        if (isWalletInfoInjectable(w)) {
          return {
            ...baseInfo,
            type: 'injected',
            jsBridgeKey: w.jsBridgeKey,
            injected: w.injected,
          };
        }

        return baseInfo;
      });

      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ count: walletList.length, wallets: walletList }, null, 2) 
        }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Error fetching wallets: ${err.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Initiate wallet connection
 * Returns a connection link that the user needs to open in their wallet
 */
server.registerTool(
  'connect_wallet',
  {
    title: 'Connect Wallet',
    description: 'Initiate wallet connection. Returns a universal link that the user must open in their wallet app. The wallet_name parameter is required - use list_wallets to see available options.',
    inputSchema: {
      wallet_name: z.string().describe('Name of the wallet to connect (e.g., "Tonkeeper", "MyTonWallet"). Use list_wallets to see available wallets.'),
    },
  },
  async ({ wallet_name }) => {
    try {
      const sessionId = getCurrentSessionId();
      const connector = getConnectorForSession(sessionId);
      
      // Restore connection if exists
      await connector.restoreConnection();
      
      if (connector.connected) {
        const account = connector.wallet?.account;
        return {
          content: [{ 
            type: 'text', 
            text: `Wallet already connected: ${account?.address || 'Unknown address'}. Use disconnect_wallet first if you want to connect a different wallet.` 
          }],
          isError: true,
        };
      }

      const wallets = await walletManager.getWallets();
      
      if (!wallets || wallets.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: 'No wallets available from TON Connect.' 
          }],
          isError: true,
        };
      }

      const selectedWallet = wallets.find((w) => 
        w.name.toLowerCase() === wallet_name.toLowerCase() || 
        w.appName.toLowerCase() === wallet_name.toLowerCase()
      );
      
      if (!selectedWallet) {
        const availableWallets = wallets.map((w) => w.name).join(', ');
        return {
          content: [{ 
            type: 'text', 
            text: `Wallet "${wallet_name}" not found. Available wallets: ${availableWallets}` 
          }],
          isError: true,
        };
      }

      let connectionSource;
      if (isWalletInfoRemote(selectedWallet)) {
        connectionSource = { 
          universalLink: selectedWallet.universalLink, 
          bridgeUrl: selectedWallet.bridgeUrl 
        };
      } else if (isWalletInfoInjectable(selectedWallet)) {
        connectionSource = { 
          jsBridgeKey: selectedWallet.jsBridgeKey 
        };
      } else {
        return {
          content: [{ 
            type: 'text', 
            text: `Wallet "${wallet_name}" has unsupported connection type.` 
          }],
          isError: true,
        };
      }

      const universalLink = connector.connect(connectionSource);

      return {
        content: [{ 
          type: 'text', 
          text: `Connection initiated for ${selectedWallet.name}.\n\nOpen this link in your wallet app:\n${universalLink}\n\nAfter approving in your wallet, use get_wallet_status to verify the connection.` 
        }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Connection error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Disconnect wallet
 */
server.registerTool(
  'disconnect_wallet',
  {
    title: 'Disconnect Wallet',
    description: 'Disconnect the currently connected wallet from this session',
    inputSchema: {},
  },
  async () => {
    try {
      const sessionId = getCurrentSessionId();
      const connector = getConnectorForSession(sessionId);
      
      if (!connector.connected) {
        return {
          content: [{ 
            type: 'text', 
            text: 'No wallet connected to disconnect.' 
          }],
        };
      }

      await connector.disconnect();

      return {
        content: [{ 
          type: 'text', 
          text: 'Wallet disconnected successfully.' 
        }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Disconnect error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Send transaction
 * Creates a transaction request that the user needs to sign
 */
server.registerTool(
  'send_transaction',
  {
    title: 'Send Transaction',
    description: 'Create and send a transaction request. The user must approve it in their connected wallet. Amount must be specified in nanoTON (1 TON = 1,000,000,000 nanoTON).',
    inputSchema: {
      to: z.string().describe('Recipient address in user-friendly format (e.g., EQD... or UQD... or 0:...)'),
      amount: z.string().describe('Amount in nanoTON as a string (1 TON = 1,000,000,000 nanoTON). Example: "1000000000" for 1 TON'),
      payload: z.string().optional().describe('Optional transaction payload as base64-encoded BOC'),
      valid_until: z.number().optional().describe('Transaction expiration timestamp in Unix seconds. Defaults to 5 minutes from now'),
    },
  },
  async ({ to, amount, payload, valid_until }) => {
    try {
      const sessionId = getCurrentSessionId();
      const connector = getConnectorForSession(sessionId);
      
      if (!connector.connected) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Wallet not connected. Use connect_wallet to establish a connection first.' 
          }],
          isError: true,
        };
      }

      // Validate amount is numeric string
      if (!/^\d+$/.test(amount)) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid amount format: "${amount}". Amount must be a numeric string in nanoTON (e.g., "1000000000" for 1 TON).` 
          }],
          isError: true,
        };
      }

      const validUntil = valid_until || Math.floor(Date.now() / 1000) + 300; // 5 minutes default
      
      const transaction = {
        validUntil,
        messages: [
          {
            address: to,
            amount: amount,
            ...(payload && { payload }),
          },
        ],
      };

      try {
        const result = await connector.sendTransaction(transaction);
        
        return {
          content: [{ 
            type: 'text', 
            text: `Transaction sent successfully!\n\nBOC: ${result.boc}\n\nThe transaction has been approved by the user and broadcast to the network.` 
          }],
        };
      } catch (error) {
        if (error instanceof UserRejectsError) {
          return {
            content: [{ 
              type: 'text', 
              text: 'Transaction rejected by user in their wallet.' 
            }],
            isError: true,
          };
        }
        throw error;
      }
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Transaction error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Sign data (proof)
 * Request wallet to sign data for authentication/verification
 */
server.registerTool(
  'sign_proof',
  {
    title: 'Sign Proof',
    description: 'Request the wallet to sign a proof payload for authentication. This creates a cryptographic signature that can verify wallet ownership.',
    inputSchema: {
      payload: z.string().describe('The payload to sign (will be used in the proof signature)'),
    },
  },
  async ({ payload }) => {
    try {
      const sessionId = getCurrentSessionId();
      const connector = getConnectorForSession(sessionId);
      
      if (!connector.connected) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Wallet not connected. Use connect_wallet to establish a connection first.' 
          }],
          isError: true,
        };
      }

      const wallet = connector.wallet;
      
      // Check if wallet supports proof signing
      if (!wallet?.connectItems?.tonProof) {
        return {
          content: [{ 
            type: 'text', 
            text: 'The connected wallet does not support proof signing. This feature requires a wallet that implements ton_proof.' 
          }],
          isError: true,
        };
      }

      return {
        content: [{ 
          type: 'text', 
          text: `Proof signing is supported by the wallet, but the TON Connect SDK requires proof to be configured during initial connection.\n\nTo use proof signing:\n1. Disconnect current wallet\n2. Reconnect with proof configuration\n3. The proof will be available in the connection response\n\nNote: ton_proof must be requested during the connect() call, not as a separate operation.` 
        }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Proof signing error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// Set up Express server
const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && sessionTransports.has(sessionId)) {
      // Existing session
      transport = sessionTransports.get(sessionId)!;
      
      // Set session context for this request
      (globalThis as any).__mcpSessionId = sessionId;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      let newSessionId: string | null = null;
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => {
          newSessionId = randomUUID();
          return newSessionId;
        },
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          sessionTransports.set(id, transport);
          console.log(`New MCP session initialized: ${id}`);
        },
      });

      transport.onclose = async () => {
        if (transport.sessionId) {
          console.log(`MCP session closing: ${transport.sessionId}`);
          sessionTransports.delete(transport.sessionId);
          await walletManager.removeConnector(transport.sessionId);
          
          // Clear session context
          if ((globalThis as any).__mcpSessionId === transport.sessionId) {
            delete (globalThis as any).__mcpSessionId;
          }
        }
      };

      await server.connect(transport);
      
      // Set session context after connection
      if (newSessionId) {
        (globalThis as any).__mcpSessionId = newSessionId;
      }
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid request: missing session ID or not an initialize request',
        },
        id: null,
      });
    }

    await transport.handleRequest(req, res, req.body);
    
    // Clear session context after request
    delete (globalThis as any).__mcpSessionId;
  } catch (error) {
    console.error('Error handling MCP request:', error);
    
    // Clear session context on error
    delete (globalThis as any).__mcpSessionId;
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  try {
    await walletManager.cleanup();
    if (redisClient) {
      await redisClient.quit();
    }
    console.log('Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 TON Connect MCP Server Started');
  console.log('='.repeat(60));
  console.log(`Server URL: http://localhost:${PORT}/mcp`);
  console.log(`Manifest: ${MANIFEST_URL === DEFAULT_MANIFEST_URL ? 'Palette (default)' : MANIFEST_URL}`);
  console.log(`Storage: ${storageType}`);
  if (!redisClient) {
    console.log('💡 Tip: Set REDIS_URL for persistent storage');
  }
  if (MANIFEST_URL === DEFAULT_MANIFEST_URL) {
    console.log('💡 Tip: Set TONCONNECT_MANIFEST_URL for custom branding');
  }
  console.log('='.repeat(60));
  console.log('\n✨ Available Tools:');
  console.log('  • list_wallets - Get available TON wallets');
  console.log('  • connect_wallet - Connect to a wallet');
  console.log('  • disconnect_wallet - Disconnect wallet');
  console.log('  • get_wallet_status - Check connection status');
  console.log('  • send_transaction - Send TON transaction');
  console.log('  • sign_proof - Request proof signature');
  console.log('='.repeat(60));
  console.log('\n✅ Ready! Connect from Cursor, Claude, or any MCP client');
  console.log('='.repeat(60) + '\n');
}).on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});

