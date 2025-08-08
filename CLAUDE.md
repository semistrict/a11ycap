# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo with 4 packages managed by pnpm workspace:
- `a11ycap/` - Core accessibility snapshot library (browser-compatible)
- `a11ycap-mcp/` - MCP (Model Context Protocol) server for web agent integration
- `testpagecra/` - Create React App test page for testing
- `babel-plugin-a11ycap/` - Babel plugin for enhanced debug information

## Common Commands

### Building and Testing
```bash
# Build all packages
pnpm build

# Run all tests (builds a11ycap, runs Playwright tests)
pnpm test

# Run tests in headed mode (visible browser)
pnpm test:headed

# Run single test file
pnpm --filter a11ycap build && playwright test test/specific-test.spec.ts

# Lint all packages
pnpm lint

# Clean all build outputs
pnpm clean
```

### Package-specific Commands
```bash
# Build only a11ycap core library
pnpm --filter a11ycap build

# Run MCP server in development mode
pnpm --filter a11ycap-mcp dev

# Type check without building
pnpm --filter a11ycap typecheck
```

## Architecture Overview

### Core Library (a11ycap/)
The main library exports AI-focused accessibility snapshot functionality:
- `snapshotForAI()` - Primary function for generating AI-readable accessibility trees
- `snapshot()` - General snapshot function supporting multiple modes ('ai', 'expect', 'codegen', 'autoexpect')
- `clickRef()` - Click elements by snapshot reference (e.g., 'e2', 'e5')
- React DevTools integration for component information extraction
- Size-limited snapshot rendering with breadth-first expansion
- CRA dev overlay handling for reliable testing

Key modules:
- `ariaSnapshot.ts` - Core ARIA tree generation and rendering
- `reactUtils.ts` - React component information extraction
- `tools/` - MCP tool implementations (takeSnapshot, clickElement, getNetworkRequests)
- `mcpConnection.ts` - WebSocket client for browser-to-MCP communication

### MCP Server (a11ycap-mcp/)
HTTP/WebSocket server providing MCP protocol endpoints:
- `/mcp` - Main MCP endpoint (Streamable HTTP protocol)
- `/browser-ws` - WebSocket endpoint for browser connections
- `/a11ycap.js` - Injectable library for browser console usage
- Supports both new Streamable HTTP and legacy SSE transports
- CORS-enabled for cross-origin browser usage

### Testing Architecture
- Playwright for end-to-end testing with accessibility snapshots
- Uses testpagecra as test server running on port 14652
- Tests verify snapshot generation, React integration, MCP tools, and element interaction
- Timeout: 5 seconds (action and navigation)
- Browser: Chromium only

## Development Workflow

1. **Core Library Changes**: Modify files in `a11ycap/src/`, run `pnpm --filter a11ycap build`
2. **MCP Server Changes**: Modify files in `a11ycap-mcp/src/`, run `pnpm --filter a11ycap-mcp build`
3. **Testing**: Always build a11ycap before running tests since Playwright tests depend on the built library
4. **Linting**: Uses Biome for consistent code formatting and linting

## Key Technical Details

- The library handles React DevTools integration with fallbacks for non-React environments
- Snapshot generation supports size limits via breadth-first tree expansion
- Element clicking uses snapshot refs (_ariaRef.ref property) for reliable interaction
- MCP integration allows web agents to take snapshots and interact with browser pages
- All browser-facing code is compatible with modern browsers (no IE 11 support)
- DO NOT run playwright directly, use pnpm test from the workspace root