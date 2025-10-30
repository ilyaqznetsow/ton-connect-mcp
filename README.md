# TON Connect MCP Server

A production-ready MCP (Model Context Protocol) server that enables AI agents to interact with TON wallets via TON Connect protocol. Users can connect their wallets and sign transactions initiated by agents.

> 🚀 **[Quick Start Guide](./QUICKSTART.md)** - Get running in 3 minutes!

## Features

- 🔌 **Wallet Connection**: Connect TON wallets via TON Connect protocol
- 💸 **Transaction Signing**: Initiate transactions that users approve in their wallets
- ✍️ **Data Signing**: Sign arbitrary data (text, binary, or cell format)
- 📊 **Wallet Status**: Check connection status and wallet information
- 🔄 **Session Management**: Per-session wallet connections

## Tools Available

### `list_wallets`
Get a list of all available TON wallets that can be connected.

### `connect_wallet`
Initiate a wallet connection. Returns a universal link that the user should open in their wallet.

**Parameters:**
- `wallet_name` (optional): Name of the wallet to connect
- `bridge_url` (optional): Bridge URL for the wallet

**Returns:** Connection link and instructions

### `get_wallet_status`
Check if a wallet is connected and get wallet information.

**Returns:** Connection status, address, chain, and wallet name

### `send_transaction`
Create a transaction request. The user will need to approve it in their connected wallet.

**Parameters:**
- `to`: Recipient address (user-friendly format)
- `amount`: Amount in nanoTON (1 TON = 1,000,000,000 nanoTON)
- `payload` (optional): Transaction payload as base64
- `valid_until` (optional): Transaction expiration timestamp (Unix seconds)

**Returns:** Transaction BOC and status

### `sign_data`
Request signature for data. The user will need to approve it in their connected wallet.

**Parameters:**
- `type`: Type of data (`text`, `binary`, or `cell`)
- `text` (required if type is `text`): Text to sign
- `bytes` (required if type is `binary`): Base64 encoded bytes
- `cell` (required if type is `cell`): Base64 encoded BoC
- `schema` (required if type is `cell`): TL-B schema
- `network` (optional): `-239` for mainnet, `-3` for testnet

**Returns:** Signature, address, and timestamp

## Quick Start

**Add to Cursor in 30 seconds:**

1. Open Cursor Settings
2. Go to **Features** → **Model Context Protocol**
3. Click **Add Server** and paste:

```json
{
  "command": "npx",
  "args": ["-y", "ton-connect-mcp"]
}
```

That's it! 🎉 Cursor will auto-start the server when needed.

- Uses Palette's manifest by default ([https://app.palette.finance/tonconnect-manifest.json](https://app.palette.finance/tonconnect-manifest.json))
- Stores sessions in-memory
- No manual server management needed

### For Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ton-connect": {
      "command": "npx",
      "args": ["-y", "ton-connect-mcp"]
    }
  }
}
```

### For VS Code

Settings → Extensions → GitHub Copilot → MCP Servers:

```json
{
  "command": "npx",
  "args": ["-y", "ton-connect-mcp"]
}
```

### Optional Configuration

Set environment variables before the MCP client starts:

**Custom Manifest** (optional):
```bash
export TONCONNECT_MANIFEST_URL="https://your-app.com/tonconnect-manifest.json"
```

Then restart your MCP client (Cursor/Claude/etc)

## Installation for Development

If you want to modify the code:

```bash
git clone https://github.com/ilyaqznetsow/ton-connect-mcp.git
cd ton-connect-mcp
npm install
npm run build
```

## Configuration

All configuration is **optional**! The server works out-of-the-box with sensible defaults.

### Environment Variables

**TONCONNECT_MANIFEST_URL** (optional):
```bash
# Default: https://app.palette.finance/tonconnect-manifest.json
export TONCONNECT_MANIFEST_URL="https://your-app.com/tonconnect-manifest.json"
```

**PORT** (optional):
```bash
# Default: 3000
export PORT=8080
```

**REDIS_URL** (optional):
```bash
# Only for persistent storage across restarts
export REDIS_URL="redis://localhost:6379"
# or for production:
export REDIS_URL="redis://user:password@redis-host:6379"
```

> **Default Behavior**: The server uses Palette's manifest and in-memory storage - perfect for personal use with Cursor/Claude!

### TON Connect Manifest

Your manifest must be:
1. Publicly accessible via HTTPS
2. Follow the official TON Connect manifest format:



```json
{
  "url": "https://your-app.com",
  "name": "Your App Name",
  "iconUrl": "https://your-app.com/icon.png",
  "termsOfUseUrl": "https://your-app.com/terms",
  "privacyPolicyUrl": "https://your-app.com/privacy"
}
```

## How It Works

The MCP client (Cursor/Claude/VS Code) automatically:
1. Downloads the package with `npx`
2. Starts the server when needed
3. Connects via stdio (standard input/output)
4. Stops it when done

**You don't manually start or stop anything!**

## Available Tools

### Wallet Management
- **list_wallets** - Get all available TON Connect wallets
- **connect_wallet** - Connect to a specific wallet (Tonkeeper, MyTonWallet, etc.)
- **disconnect_wallet** - Disconnect current wallet
- **get_wallet_status** - Check connection status and wallet info

### Transactions
- **send_transaction** - Send TON with optional payloads
  - Simple transfers with comments
  - Custom smart contract calls
  - Contract deployments with state_init
  - Raw base64 BOC payloads

### Helpers
- **build_jetton_transfer_payload** - Guide for jetton (token) transfers
- **sign_proof** - Authentication proof signing

## Testing

Try these in your AI assistant:

### Basic Wallet Operations
1. "What TON wallets can I connect?"
2. "Connect my Tonkeeper wallet"
3. "What's my wallet address?"

### Simple Transfers
4. "Send 0.1 TON to EQD... with comment 'Hello TON!'"
5. "Send 1 TON to UQA..."

### Advanced Transactions
6. "Help me send USDT jettons to my friend"
7. "Send a transaction with this base64 payload: te6c..."
8. "Deploy a contract with this state_init: te6c..."

## Troubleshooting

### "Server startup error: EADDRINUSE" or "port 3000"

This means you have an old HTTP version cached. Fix:

```bash
# Clear npm cache and reinstall
npm cache clean --force
npm uninstall -g ton-connect-mcp
npm install -g ton-connect-mcp@latest

# Or use npx with latest
# In Cursor config, use:
{
  "command": "npx",
  "args": ["-y", "ton-connect-mcp@latest"]
}
```

### Cursor not seeing the server

1. Restart Cursor completely
2. Check Settings → Features → Model Context Protocol
3. Verify the config is correct
4. Try removing and re-adding the server

## Transaction Payloads

### Simple Transfers with Comments
Use the `comment` parameter - it's automatically encoded:
```javascript
{
  to: "EQD...",
  amount: "100000000",  // 0.1 TON
  comment: "Payment for services"
}
```

### Jetton (Token) Transfers
Use `build_jetton_transfer_payload` for guidance, then:
```javascript
{
  to: "EQC...",  // Your jetton wallet address
  amount: "50000000",  // Gas: 0.05 TON
  payload: "te6c..."  // Base64 BOC from @ton/ton library
}
```

### Custom Smart Contract Calls
Provide raw base64 BOC payload:
```javascript
{
  to: "EQA...",  // Contract address
  amount: "10000000",  // 0.01 TON
  payload: "te6c..."  // Your custom BOC
}
```

### Contract Deployment
Include state_init:
```javascript
{
  to: "EQB...",  // New contract address
  amount: "100000000",  // Initial balance
  state_init: "te6c...",  // Contract code + data
  payload: "te6c..."  // Optional init message
}
```

## Implementation Details

- **Transport**: stdio (standard input/output) - auto-managed by MCP clients
- **Storage**: In-memory (perfect for personal use)
- **Protocol**: Real TON Connect SDK - no mocks
- **Session**: Single session per process instance
- **Manifest**: Palette Finance (default)
- **Dependencies**: Minimal (MCP SDK, TON Connect SDK, Zod)
- **Payload Support**: Comments, custom BOC, state_init for all transaction types

### Why stdio?

- **Auto-start**: MCP client launches the server automatically
- **Auto-stop**: Server stops when not needed
- **No ports**: No port conflicts or firewall issues
- **Simple**: No HTTP server, no manual management
- **Perfect for AI assistants**: Cursor, Claude, VS Code handle everything

## Usage Example

1. **List available wallets:**
   ```
   Agent: Use list_wallets tool
   Result: Returns actual wallets from TON Connect registry (Tonkeeper, MyTonWallet, etc.)
   ```

2. **Connect a wallet:**
   ```
   Agent: Use connect_wallet tool with wallet_name="Tonkeeper"
   Result: Returns a real TON Connect universal link
   User: Opens the link in their Tonkeeper app and approves connection
   ```

3. **Check connection status:**
   ```
   Agent: Use get_wallet_status tool
   Result: Shows actual wallet address, chain, and public key
   ```

4. **Send a transaction:**
   ```
   Agent: Use send_transaction tool with to="EQD...", amount="1000000000"
   Result: User approves in their wallet, returns actual transaction BOC
   User: Approves transaction in wallet
   ```

5. **Sign data:**
   ```
   Agent: Use sign_data tool with type="text", text="Hello TON"
   User: Approves signing in wallet
   ```

## Architecture

The server follows SOLID principles:

- **Single Responsibility**: Each module has a single, well-defined purpose
  - `storage.ts`: Storage abstraction
  - `wallet-manager.ts`: Wallet connection management
  - `index.ts`: MCP server and tools

- **Open/Closed**: Extensible through tool registration
- **Liskov Substitution**: Uses TON Connect SDK interfaces
- **Interface Segregation**: Clean separation of concerns
- **Dependency Inversion**: Depends on abstractions (IStorage)

KISS principle: Simple, straightforward implementation without over-engineering.

## License

MIT

