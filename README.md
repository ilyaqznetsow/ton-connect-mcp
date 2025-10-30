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

**Literally zero setup!** Just run one command:

```bash
npx ton-connect-mcp
```

That's it! 🎉 The server:
- Uses Palette's manifest by default ([https://app.palette.finance/tonconnect-manifest.json](https://app.palette.finance/tonconnect-manifest.json))
- Stores sessions in-memory (no Redis needed)
- Works instantly with Cursor, Claude, and any MCP client

### Installation Options

**Option 1: npx (Recommended - No Installation)**
```bash
npx ton-connect-mcp
```

**Option 2: Global Install**
```bash
npm install -g ton-connect-mcp
ton-connect-mcp
```

### Optional Configuration

**Custom Branding** (optional):
```bash
export TONCONNECT_MANIFEST_URL="https://your-app.com/tonconnect-manifest.json"
npx ton-connect-mcp
```

**Persistent Storage** (optional):
```bash
# Only if you need wallet connections to survive server restarts
docker run -d -p 6379:6379 redis:alpine
export REDIS_URL="redis://localhost:6379"
npx ton-connect-mcp
```

**Custom Port** (optional):
```bash
export PORT=8080
npx ton-connect-mcp
```

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

## Running

### For End Users

**Just run it!** No configuration needed:

```bash
npx ton-connect-mcp
```

The server starts instantly with:
- ✅ Palette's TON Connect manifest (default)
- ✅ In-memory storage
- ✅ Port 3000
- ✅ Ready for Cursor, Claude, VS Code, or any MCP client!

### For Development

```bash
git clone https://github.com/ilyaqznetsow/ton-connect-mcp.git
cd ton-connect-mcp
npm install
npm run dev
```

### For Production (optional Redis)

Only if you need persistence across restarts:

```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Run with Redis
export REDIS_URL="redis://localhost:6379"
npm run build
npm start
```

Server runs on `http://localhost:3000/mcp` by default.

## Connecting from MCP Clients

First, start the server:

```bash
npx ton-connect-mcp
```

Then connect your MCP client:

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "ton-connect": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

### Cursor

Add via Cursor settings or use the deeplink:
```
cursor://anysphere.cursor-deeplink/mcp/install?name=ton-connect&config=eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAvbWNwIn0%3D
```

### VS Code

```bash
code --add-mcp "{\"name\":\"ton-connect\",\"type\":\"http\",\"url\":\"http://localhost:3000/mcp\"}"
```

### Using with Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  ton-connect-mcp:
    image: node:20-alpine
    command: npx @your-org/ton-connect-mcp
    environment:
      - TONCONNECT_MANIFEST_URL=https://your-app.com/tonconnect-manifest.json
      - REDIS_URL=redis://redis:6379
      - PORT=3000
    ports:
      - "3000:3000"
    depends_on:
      - redis
```

Then run:
```bash
docker-compose up
```

## Implementation Details

This MCP server provides a real, production-ready TON Connect integration:

- **No Mock Data**: All wallet connections and transactions use the actual TON Connect protocol
- **Zero Setup**: Works out-of-the-box with in-memory storage
- **Session Isolation**: Each MCP session gets its own TON Connect instance
- **Real Wallet Connections**: Wallets are discovered from the official TON Connect wallet registry
- **Transaction Signing**: All transactions are signed by the user's actual wallet
- **Error Handling**: Proper handling of user rejections and connection errors
- **Optional Redis**: Add persistence if needed - completely optional

### Storage Modes

**In-Memory (Default)**
- Perfect for personal use with Cursor/Claude
- No setup required
- Wallet connections work during your session
- Clears on server restart (just reconnect your wallet)

**Redis (Optional)**
- For production deployments
- Wallet connections persist across restarts
- Multiple server instances can share state
- Set `REDIS_URL` to enable

### Architecture (SOLID & KISS Principles)

- **Single Responsibility**: Each class has one clear purpose
- **Dependency Inversion**: Components depend on abstractions (`IStorage` interface)
- **Interface Segregation**: Clean, focused interfaces
- **KISS**: Simple implementation - no over-engineering, works instantly

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

