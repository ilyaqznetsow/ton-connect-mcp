# TON Connect MCP v1.0.0 - Release Notes

## 🎉 Zero-Setup TON Connect Integration for AI Assistants

The simplest way to add TON blockchain wallet functionality to Cursor, Claude, VS Code, and other AI assistants using the Model Context Protocol (MCP).

## ✨ Key Features

### Truly Zero Setup
- **No configuration required** - Just run `npx ton-connect-mcp`
- **No database needed** - Uses in-memory storage by default
- **Default manifest included** - Uses Palette's TON Connect manifest
- **Instant start** - Ready in seconds

### Production Ready
- **Real TON Connect Protocol** - No mock data, no fallbacks
- **Session isolation** - Each MCP session gets its own TON Connect instance
- **Clean architecture** - SOLID & KISS principles
- **Optional Redis** - Add persistence when you need it

### Developer Friendly
- **TypeScript** - Full type definitions included
- **Well documented** - Complete README and examples
- **Small package** - Only 14.3 KB compressed
- **No dependencies bloat** - Only essential dependencies

## 🚀 Quick Start

```bash
# That's literally it!
npx ton-connect-mcp
```

Then connect from your MCP client (Cursor, Claude, etc.) to `http://localhost:3000/mcp`

## 🔧 What's Included

### Tools Available
- **list_wallets** - Discover available TON wallets
- **connect_wallet** - Connect user's wallet via TON Connect
- **disconnect_wallet** - Disconnect current wallet
- **get_wallet_status** - Check connection status and wallet info
- **send_transaction** - Send TON transactions (user approves in wallet)
- **sign_proof** - Request cryptographic proof signatures

### Default Configuration
- **Manifest**: https://app.palette.finance/tonconnect-manifest.json (Palette DeFi)
- **Storage**: In-memory (no setup required)
- **Port**: 3000
- **Protocol**: Real TON Connect (no mocks)

### Optional Enhancements
- Set `TONCONNECT_MANIFEST_URL` for custom branding
- Set `REDIS_URL` for persistent storage across restarts
- Set `PORT` for custom server port

## 📦 Installation Methods

### npx (Recommended)
```bash
npx ton-connect-mcp
```

### Global Install
```bash
npm install -g ton-connect-mcp
ton-connect-mcp
```

### Docker
```bash
docker run -d -p 3000:3000 -e TONCONNECT_MANIFEST_URL=... node:20-alpine npx ton-connect-mcp
```

## 🔌 MCP Client Setup

### Cursor
```
cursor://anysphere.cursor-deeplink/mcp/install?name=ton-connect&config=eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAvbWNwIn0%3D
```

### Claude Desktop
Add to `claude_desktop_config.json`:
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

### VS Code
```bash
code --add-mcp "{\"name\":\"ton-connect\",\"type\":\"http\",\"url\":\"http://localhost:3000/mcp\"}"
```

## 💡 Use Cases

- **AI-Powered DeFi**: Let AI assistants help users interact with DeFi protocols
- **Wallet Management**: Check balances, send transactions via natural language
- **Transaction Building**: AI can construct complex transactions for users to approve
- **Educational**: Learn about TON blockchain through AI interaction
- **Development**: Test TON Connect integration without building UI

## 🏗️ Architecture

### SOLID Principles
- **Single Responsibility**: Each class has one clear purpose
- **Open/Closed**: Extensible without modification
- **Liskov Substitution**: Storage implementations are interchangeable
- **Interface Segregation**: Clean, focused interfaces
- **Dependency Inversion**: Depends on abstractions, not concretions

### KISS Philosophy
- Simple, direct implementation
- No unnecessary abstractions
- Works out of the box
- Clear, readable code

## 📊 Technical Details

- **Package**: ton-connect-mcp
- **Version**: 1.0.0
- **Size**: 14.3 KB compressed, 58 KB unpacked
- **Dependencies**: Minimal (MCP SDK, TON Connect SDK, Express, Zod)
- **Optional**: Redis for persistence
- **Node**: >= 18.0.0
- **License**: MIT

## 🙏 Credits

- Built with [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- Uses [@tonconnect/sdk](https://www.npmjs.com/package/@tonconnect/sdk)
- Default manifest by [Palette Finance](https://palette.finance)

## 🔗 Links

- **NPM**: https://www.npmjs.com/package/ton-connect-mcp
- **GitHub**: https://github.com/ilyaqznetsow/ton-connect-mcp
- **Issues**: https://github.com/ilyaqznetsow/ton-connect-mcp/issues
- **TON Connect**: https://docs.ton.org/develop/dapps/ton-connect/overview
- **MCP Protocol**: https://modelcontextprotocol.io

## 🎯 What's Next

Future versions may include:
- More wallet operations (stake, swap, etc.)
- NFT operations
- Jetton (token) transfers
- Multi-wallet support
- Enhanced proof signing

## 📝 Changelog

### v1.0.0 (Initial Release)
- ✅ Zero-setup installation
- ✅ Default TON Connect manifest
- ✅ In-memory storage (no Redis required)
- ✅ Six essential wallet tools
- ✅ Production-ready architecture
- ✅ Complete documentation
- ✅ SOLID & KISS principles
- ✅ Optional Redis support

---

**Try it now**: `npx ton-connect-mcp` 🚀

