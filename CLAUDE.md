# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Information

- **GitHub Origin**: git@github.com:semistrict/a11ycap.git
- **Current Branch**: refactor/sessionid-primary-identifier
- **PR Commands**:
  ```bash
  # View current PR
  gh pr view --repo semistrict/a11ycap
  
  # Check PR comments and reviews
  gh pr view 1 --repo semistrict/a11ycap --comments
  
  # Check CodeRabbit or other bot reviews
  gh pr view 1 --repo semistrict/a11ycap --json comments --jq '.comments[] | select(.user.login == "coderabbitai")'
  ```

## Project Structure

This is a monorepo with 4 packages managed by pnpm workspace:
- `a11ycap/` - Core accessibility snapshot library (browser-compatible)
- `a11ycap-mcp/` - MCP (Model Context Protocol) server for web agent integration
- `testpagecra/` - Create React App test page for testing (port 14652)
- `babel-plugin-a11ycap/` - Babel plugin for enhanced debug information

## Common Commands

### Building
```bash
# Build all packages
pnpm build

# Build only a11ycap core library
pnpm --filter a11ycap build

# Type check a11ycap without building
pnpm --filter a11ycap typecheck

# Lint all packages (uses Biome)
pnpm lint

# Fix lint issues
pnpm --filter [package-name] run lint:fix

# Clean all build outputs
pnpm clean

# Check for code duplication
pnpm dup
```

### Testing
See: @docs/testing.md

### Package-specific Commands
```bash
# Run MCP server in development mode (builds all first)
pnpm --filter a11ycap-mcp dev

# Start MCP server (assumes built)
pnpm --filter a11ycap-mcp start

# Run testpagecra dev server
cd testpagecra && PORT=14652 BROWSER=none pnpm start
```

## Architecture Overview

### Core Library (a11ycap/)
The main library exports AI-focused accessibility snapshot functionality:
- `snapshotForAI()` - Primary function for generating AI-readable accessibility trees
- `snapshot()` - General snapshot function supporting multiple modes ('ai', 'expect', 'codegen', 'autoexpect')
- `clickRef()` - Click elements by snapshot reference (e.g., 'e2', 'e5')
- `findElementByRef()` - Find DOM element by snapshot ref
- `getElementPicker()` - Interactive element picker utility
- React DevTools integration for component information extraction
- Size-limited snapshot rendering with breadth-first expansion
- CRA dev overlay handling for reliable testing

Key modules:
- `ariaSnapshot.ts` - Core ARIA tree generation and rendering
- `reactUtils.ts` - React component information extraction
- `elementPicker.ts` - Visual element picker implementation
- `tools/` - MCP tool implementations (takeSnapshot, clickElement, getNetworkRequests, etc.)
- `mcpConnection.ts` - WebSocket client for browser-to-MCP communication
- `isomorphic/` - Shared utilities between browser and server

### MCP Server (a11ycap-mcp/)
Stdio-based MCP server with WebSocket support for browser connections:
- Uses stdio transport for MCP protocol communication
- WebSocket server on port 12456 (configurable via PORT env var)
- Primary/secondary server architecture for multiple MCP instances
- Browser injection script available via console paste
- Uses sessionId as primary identifier for browser connections
- Defers connection creation until page_info message is received

Key modules:
- `index.ts` - Main server entry with stdio transport
- `mcp-server.ts` - MCP tool implementations
- `browser-connection-manager.ts` - WebSocket management and browser connection handling with sessionId-based routing

## Development Workflow

1. **Core Library Changes**: Modify files in `a11ycap/src/`, run `pnpm --filter a11ycap build`
2. **MCP Server Changes**: Modify files in `a11ycap-mcp/src/`, run `pnpm --filter a11ycap-mcp build`
3. **Testing**: See @reference docs/testing.md
4. **Linting**: Uses Biome with 2-space indentation, single quotes for JS/TS

## Key Technical Details

- The library handles React DevTools integration with fallbacks for non-React environments
- Snapshot generation supports size limits via breadth-first tree expansion
- Element clicking uses snapshot refs stored in `_ariaRef.ref` property on DOM elements
- MCP integration allows web agents to take snapshots and interact with browser pages
- All browser-facing code is compatible with modern browsers (no IE 11 support)
- Test page (testpagecra) uses craco for custom Babel configuration
- Babel plugin adds debug source info to JSX elements as data attributes
