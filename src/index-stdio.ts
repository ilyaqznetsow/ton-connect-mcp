#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import TonConnect, { UserRejectsError, isWalletInfoRemote, isWalletInfoInjectable } from '@tonconnect/sdk';
import { MemoryStorage } from './storage.js';

const DEFAULT_MANIFEST_URL = 'https://app.palette.finance/tonconnect-manifest.json';
const MANIFEST_URL = process.env.TONCONNECT_MANIFEST_URL || DEFAULT_MANIFEST_URL;

// Create single TON Connect instance for stdio session
const storage = new MemoryStorage();
const connector = new TonConnect({
  manifestUrl: MANIFEST_URL,
  storage,
});

// Restore connection on startup
await connector.restoreConnection();

// Create MCP server
const server = new McpServer({
  name: 'ton-connect-mcp',
  version: '1.0.0',
});

/**
 * Tool: Get wallet connection status
 */
server.registerTool(
  'get_wallet_status',
  {
    title: 'Get Wallet Status',
    description: 'Check if a wallet is connected and get wallet information',
    inputSchema: {},
  },
  async () => {
    try {
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
      const wallets = await TonConnect.getWallets();
      
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
 */
server.registerTool(
  'connect_wallet',
  {
    title: 'Connect Wallet',
    description: 'Initiate wallet connection. Returns a universal link that the user must open in their wallet app.',
    inputSchema: {
      wallet_name: z.string().describe('Name of the wallet to connect (e.g., "Tonkeeper", "MyTonWallet"). Use list_wallets to see available wallets.'),
    },
  },
  async ({ wallet_name }) => {
    try {
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

      const wallets = await TonConnect.getWallets();
      
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
    description: 'Disconnect the currently connected wallet',
    inputSchema: {},
  },
  async () => {
    try {
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
      if (!connector.connected) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Wallet not connected. Use connect_wallet to establish a connection first.' 
          }],
          isError: true,
        };
      }

      if (!/^\d+$/.test(amount)) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid amount format: "${amount}". Amount must be a numeric string in nanoTON (e.g., "1000000000" for 1 TON).` 
          }],
          isError: true,
        };
      }

      const validUntil = valid_until || Math.floor(Date.now() / 1000) + 300;
      
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
 * Tool: Sign proof
 */
server.registerTool(
  'sign_proof',
  {
    title: 'Sign Proof',
    description: 'Request the wallet to sign a proof payload for authentication.',
    inputSchema: {
      payload: z.string().describe('The payload to sign'),
    },
  },
  async ({ payload }) => {
    try {
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

// Graceful shutdown
async function shutdown(): Promise<void> {
  try {
    if (connector.connected) {
      await connector.disconnect();
    }
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

