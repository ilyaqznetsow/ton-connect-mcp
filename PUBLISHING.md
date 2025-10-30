# Publishing Guide

## Pre-Publish Checklist

✅ Version: 1.0.0
✅ Author: ilyaqznetsow
✅ License: MIT
✅ Repository: https://github.com/ilyaqznetsow/ton-connect-mcp
✅ Default manifest: https://app.palette.finance/tonconnect-manifest.json
✅ Build successful
✅ Package size: 14.3 KB

## Publishing Steps

### 1. Login to NPM

```bash
npm login
```

### 2. Test the Package Locally

```bash
# Create tarball
npm pack

# Test installation
npm install -g ./ton-connect-mcp-1.0.0.tgz

# Test running
ton-connect-mcp

# Should start without any environment variables!
```

### 3. Publish to NPM

```bash
npm publish
```

That's it! The package will be available at:
- NPM: https://www.npmjs.com/package/ton-connect-mcp
- Install: `npm install -g ton-connect-mcp`
- Run: `npx ton-connect-mcp`

## After Publishing

1. **Test installation from NPM:**
```bash
npx ton-connect-mcp
```

2. **Update GitHub repository:**
- Push code to GitHub
- Create release v1.0.0
- Add release notes

3. **Share:**
- Tweet about it
- Post on TON community
- Share in MCP community

## Future Updates

To publish updates:

```bash
# Patch (1.0.0 → 1.0.1)
npm version patch
npm publish

# Minor (1.0.0 → 1.1.0)
npm version minor
npm publish

# Major (1.0.0 → 2.0.0)
npm version major
npm publish
```

## What Users Will Get

When users run `npx ton-connect-mcp`, they get:

1. **Zero setup** - No configuration needed
2. **Default manifest** - Palette's TON Connect manifest
3. **In-memory storage** - No Redis required
4. **Instant start** - Works in seconds
5. **MCP compatible** - Ready for Cursor, Claude, VS Code

## Support

Users can:
- Open issues: https://github.com/ilyaqznetsow/ton-connect-mcp/issues
- Read docs: https://github.com/ilyaqznetsow/ton-connect-mcp#readme
- Use with any MCP client

## Package Info

- **Name**: `ton-connect-mcp`
- **Description**: Zero-setup MCP server for TON Connect wallet integration
- **Keywords**: mcp, ton, tonconnect, wallet, blockchain, cursor, claude, ai
- **Size**: 14.3 KB compressed, 58 KB unpacked
- **Node**: >= 18.0.0

