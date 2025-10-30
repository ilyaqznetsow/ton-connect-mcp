# Changelog

## [1.2.0] - 2024-10-30

### Added
- **@ton/ton Library Integration**:
  - Full BOC (Bag of Cells) building capability included
  - No external tools needed for payload construction
  - Native support for complex transaction types

- **Enhanced Transaction Payloads**:
  - `comment` parameter for simple text messages (automatically encoded to BOC)
  - `state_init` parameter for contract deployment transactions
  - `payload` parameter accepts raw base64-encoded BOC for custom smart contract calls
  
- **New Tool**: `build_jetton_transfer_payload`
  - **Actually builds** TEP-74 compliant jetton transfer payloads
  - Returns ready-to-use base64 BOC
  - Supports comments via forward_payload
  - Validates addresses and amounts
  - Example: Send USDT, STON, or any jetton

- **New Tool**: `build_nft_transfer_payload`
  - **Actually builds** TEP-62 compliant NFT transfer payloads
  - Returns ready-to-use base64 BOC
  - Supports transfer comments
  - Validates addresses

- **Comprehensive Documentation**:
  - Added payload examples for all transaction types
  - Simple transfers with comments
  - Jetton transfers (2-step process)
  - NFT transfers
  - Custom smart contract calls
  - Contract deployments

### Improved
- Better transaction result messages showing payload type used
- Enhanced tool descriptions with more details
- Updated README with complete payload usage examples
- Added BOC building status to startup logs

### Dependencies
- Added `@ton/ton` and `@ton/core` for native BOC building

## [1.0.1] - 2024-10-30

### Changed
- **Architecture**: Switched from HTTP to stdio transport
  - Enables auto-start by MCP clients (Cursor, Claude Desktop, VS Code)
  - No manual server startup required
  - No port configuration needed
  - Simplified deployment

### Removed
- Express.js HTTP server
- Redis dependency (simplified to in-memory storage only)
- Port and session management complexity

### Fixed
- `EADDRINUSE` errors from HTTP server conflicts
- Installation issues with MCP clients

## [1.0.0] - 2024-10-30

### Initial Release
- Full TON Connect SDK integration
- Wallet connection management
- Transaction sending
- Basic proof signing support
- MCP server implementation
- In-memory and Redis storage options
- HTTP transport with session management

