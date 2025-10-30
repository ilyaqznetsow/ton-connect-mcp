#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import TonConnect, { UserRejectsError, isWalletInfoRemote, isWalletInfoInjectable } from '@tonconnect/sdk';
import { MemoryStorage } from './storage.js';
import { beginCell, Address } from '@ton/ton';

const DEFAULT_MANIFEST_URL = 'https://app.palette.finance/tonconnect-manifest.json';
const MANIFEST_URL = process.env.TONCONNECT_MANIFEST_URL || DEFAULT_MANIFEST_URL;

// Create single TON Connect instance
const storage = new MemoryStorage();
const connector = new TonConnect({
  manifestUrl: MANIFEST_URL,
  storage,
});

// Try to restore previous connection
try {
  await connector.restoreConnection();
} catch (error) {
  // Silently ignore restore errors
}

// Create MCP server
const server = new McpServer({
  name: 'ton-connect-mcp',
  version: '1.2.0',
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
 * Tool: Send transaction with payload support
 */
server.registerTool(
  'send_transaction',
  {
    title: 'Send Transaction',
    description: 'Send TON transactions with optional payloads. Supports simple transfers, jetton transfers, NFT operations, and custom smart contract calls.',
    inputSchema: {
      to: z.string().describe('Recipient address in user-friendly format (e.g., EQD... or UQD... or 0:...)'),
      amount: z.string().describe('Amount in nanoTON as a string (1 TON = 1,000,000,000 nanoTON). Example: "1000000000" for 1 TON'),
      payload: z.string().optional().describe('Optional base64-encoded BOC payload for smart contract interactions, jetton transfers, etc.'),
      state_init: z.string().optional().describe('Optional base64-encoded state init for contract deployment'),
      valid_until: z.number().optional().describe('Transaction expiration timestamp in Unix seconds. Defaults to 5 minutes from now'),
      comment: z.string().optional().describe('Optional text comment (will be converted to payload automatically)'),
    },
  },
  async ({ to, amount, payload, state_init, valid_until, comment }) => {
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

      // Validate amount
      if (!/^\d+$/.test(amount)) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid amount format: "${amount}". Amount must be a numeric string in nanoTON (e.g., "1000000000" for 1 TON).` 
          }],
          isError: true,
        };
      }

      // Handle comment - convert to payload if no payload provided
      let finalPayload = payload;
      if (comment && !payload) {
        try {
          // Simple text comment payload (op code 0x00000000 + text)
          const commentBuffer = Buffer.from(comment, 'utf-8');
          const payloadBuffer = Buffer.concat([
            Buffer.from([0x00, 0x00, 0x00, 0x00]), // op code for text comment
            commentBuffer
          ]);
          finalPayload = payloadBuffer.toString('base64');
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Failed to encode comment: ${(error as Error).message}` 
            }],
            isError: true,
          };
        }
      }

      const validUntil = valid_until || Math.floor(Date.now() / 1000) + 300;
      
      // Build message
      const message: any = {
        address: to,
        amount: amount,
      };

      if (finalPayload) {
        message.payload = finalPayload;
      }

      if (state_init) {
        message.stateInit = state_init;
      }

      const transaction = {
        validUntil,
        messages: [message],
      };

      try {
        const result = await connector.sendTransaction(transaction);
        
        let details = `Transaction sent successfully!\n\nBOC: ${result.boc}\n`;
        if (comment) {
          details += `Comment: "${comment}"\n`;
        }
        if (finalPayload && !comment) {
          details += `Custom payload included\n`;
        }
        if (state_init) {
          details += `Contract deployment included\n`;
        }
        details += `\nThe transaction has been approved and broadcast to the network.`;
        
        return {
          content: [{ 
            type: 'text', 
            text: details
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
 * Tool: Build jetton transfer payload
 */
server.registerTool(
  'build_jetton_transfer_payload',
  {
    title: 'Build Jetton Transfer Payload',
    description: 'Build a payload for jetton (token) transfers. Returns base64 BOC payload ready to use with send_transaction.',
    inputSchema: {
      recipient_address: z.string().describe('Recipient TON wallet address (where jettons will be sent)'),
      jetton_amount: z.string().describe('Amount of jettons to transfer in smallest units (e.g., "1000000" for 1 USDT with 6 decimals)'),
      response_address: z.string().optional().describe('Address to receive excess TON (defaults to sender). Usually your wallet address.'),
      forward_ton_amount: z.string().optional().describe('Amount of TON to forward with transfer (in nanoTON). Default: "1"'),
      forward_payload: z.string().optional().describe('Optional text comment for the transfer'),
    },
  },
  async ({ recipient_address, jetton_amount, response_address, forward_ton_amount, forward_payload }) => {
    try {
      // Validate addresses
      let recipientAddr: Address;
      let responseAddr: Address | null = null;

      try {
        recipientAddr = Address.parse(recipient_address);
      } catch (error) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid recipient address: ${recipient_address}. Use format like EQD... or UQD...` 
          }],
          isError: true,
        };
      }

      if (response_address) {
        try {
          responseAddr = Address.parse(response_address);
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Invalid response address: ${response_address}. Use format like EQD... or UQD...` 
            }],
            isError: true,
          };
        }
      }

      // Validate jetton amount
      if (!/^\d+$/.test(jetton_amount)) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid jetton amount: "${jetton_amount}". Must be a numeric string.` 
          }],
          isError: true,
        };
      }

      const forwardAmount = forward_ton_amount || "1";
      if (!/^\d+$/.test(forwardAmount)) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid forward TON amount: "${forwardAmount}". Must be a numeric string in nanoTON.` 
          }],
          isError: true,
        };
      }

      // Build jetton transfer payload
      // Standard TEP-74 jetton transfer format
      const body = beginCell()
        .storeUint(0x0f8a7ea5, 32) // jetton transfer op code
        .storeUint(0, 64) // query_id
        .storeCoins(BigInt(jetton_amount)) // amount
        .storeAddress(recipientAddr) // destination
        .storeAddress(responseAddr) // response_destination (null if not provided)
        .storeBit(0) // custom_payload (null)
        .storeCoins(BigInt(forwardAmount)); // forward_ton_amount

      // Add forward payload if comment provided
      if (forward_payload) {
        const commentCell = beginCell()
          .storeUint(0, 32) // text comment op code
          .storeStringTail(forward_payload)
          .endCell();
        
        body.storeBit(1); // forward_payload present
        body.storeRef(commentCell);
      } else {
        body.storeBit(0); // no forward_payload
      }

      const payloadCell = body.endCell();
      const payloadBase64 = payloadCell.toBoc().toString('base64');

      const result = {
        payload: payloadBase64,
        details: {
          recipient: recipient_address,
          jetton_amount: jetton_amount,
          forward_ton_amount: forwardAmount,
          response_destination: response_address || 'null (excess returned to sender)',
          ...(forward_payload && { comment: forward_payload }),
        }
      };

      return {
        content: [{ 
          type: 'text', 
          text: `✅ Jetton Transfer Payload Built!\n\n**Base64 Payload:**\n\`\`\`\n${payloadBase64}\n\`\`\`\n\n**Details:**\n${JSON.stringify(result.details, null, 2)}\n\n**Next Step:**\nUse send_transaction with:\n- to: <YOUR_JETTON_WALLET_ADDRESS> (not the recipient!)\n- amount: "50000000" (0.05 TON for gas)\n- payload: "${payloadBase64}"\n\n⚠️ Important: The 'to' address must be YOUR jetton wallet address, not the recipient's address!` 
        }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Error building payload: ${err.message}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Build NFT transfer payload
 */
server.registerTool(
  'build_nft_transfer_payload',
  {
    title: 'Build NFT Transfer Payload',
    description: 'Build a payload for NFT transfers. Returns base64 BOC payload ready to use with send_transaction.',
    inputSchema: {
      new_owner_address: z.string().describe('New owner TON wallet address (recipient)'),
      response_address: z.string().optional().describe('Address to receive excess TON. Usually your wallet address.'),
      forward_amount: z.string().optional().describe('Amount of TON to forward to new owner (in nanoTON). Default: "1"'),
      forward_payload: z.string().optional().describe('Optional text comment for the transfer'),
    },
  },
  async ({ new_owner_address, response_address, forward_amount, forward_payload }) => {
    try {
      // Validate addresses
      let newOwnerAddr: Address;
      let responseAddr: Address | null = null;

      try {
        newOwnerAddr = Address.parse(new_owner_address);
      } catch (error) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid new owner address: ${new_owner_address}. Use format like EQD... or UQD...` 
          }],
          isError: true,
        };
      }

      if (response_address) {
        try {
          responseAddr = Address.parse(response_address);
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Invalid response address: ${response_address}. Use format like EQD... or UQD...` 
            }],
            isError: true,
          };
        }
      }

      const forwardAmt = forward_amount || "1";
      if (!/^\d+$/.test(forwardAmt)) {
        return {
          content: [{ 
            type: 'text', 
            text: `Invalid forward amount: "${forwardAmt}". Must be a numeric string in nanoTON.` 
          }],
          isError: true,
        };
      }

      // Build NFT transfer payload
      // Standard TEP-62 NFT transfer format
      const body = beginCell()
        .storeUint(0x5fcc3d14, 32) // NFT transfer op code
        .storeUint(0, 64) // query_id
        .storeAddress(newOwnerAddr) // new_owner
        .storeAddress(responseAddr) // response_destination
        .storeBit(0) // custom_payload (null)
        .storeCoins(BigInt(forwardAmt)); // forward_amount

      // Add forward payload if comment provided
      if (forward_payload) {
        const commentCell = beginCell()
          .storeUint(0, 32) // text comment op code
          .storeStringTail(forward_payload)
          .endCell();
        
        body.storeBit(1); // forward_payload present
        body.storeRef(commentCell);
      } else {
        body.storeBit(0); // no forward_payload
      }

      const payloadCell = body.endCell();
      const payloadBase64 = payloadCell.toBoc().toString('base64');

      const result = {
        payload: payloadBase64,
        details: {
          new_owner: new_owner_address,
          forward_amount: forwardAmt,
          response_destination: response_address || 'null (excess returned to sender)',
          ...(forward_payload && { comment: forward_payload }),
        }
      };

      return {
        content: [{ 
          type: 'text', 
          text: `✅ NFT Transfer Payload Built!\n\n**Base64 Payload:**\n\`\`\`\n${payloadBase64}\n\`\`\`\n\n**Details:**\n${JSON.stringify(result.details, null, 2)}\n\n**Next Step:**\nUse send_transaction with:\n- to: <NFT_ITEM_ADDRESS> (the specific NFT contract address)\n- amount: "50000000" (0.05 TON for gas)\n- payload: "${payloadBase64}"\n\n⚠️ Important: The 'to' address must be the NFT item's contract address!` 
        }],
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: [{ type: 'text', text: `Error building NFT payload: ${err.message}` }],
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

console.error('🚀 TON Connect MCP Server Ready!');
console.error(`Manifest: ${MANIFEST_URL === DEFAULT_MANIFEST_URL ? 'Palette (default)' : MANIFEST_URL}`);
console.error('✨ Tools: list_wallets, connect_wallet, disconnect_wallet, get_wallet_status,');
console.error('         send_transaction, build_jetton_transfer_payload,');
console.error('         build_nft_transfer_payload, sign_proof');
console.error('📦 BOC Building: Enabled (@ton/ton included)');

