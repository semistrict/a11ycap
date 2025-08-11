# a11ycap

AI-focused accessibility snapshot library and MCP server for web automation. Extracted from Playwright's accessibility snapshot functionality with enhanced features for AI agents and browser automation.

## Features

- 🤖 **AI-Optimized Snapshots** - Generate accessibility trees optimized for AI/LLM consumption
- 🔍 **Element Interaction** - Click and interact with elements using snapshot references
- ⚛️ **React DevTools Integration** - Extract React component information in snapshots
- 🎯 **MCP Protocol Support** - Model Context Protocol server for AI agent integration
- 📏 **Size-Limited Snapshots** - Breadth-first rendering with configurable size limits
- 🎨 **Visual Element Picker** - Interactive element selection overlay

## Project Structure

This is a monorepo managed with pnpm workspaces:

- **`a11ycap/`** - Core accessibility snapshot library (browser-compatible)
- **`a11ycap-mcp/`** - MCP server for web agent integration
- **`testpagecra/`** - React test application for development
- **`babel-plugin-a11ycap/`** - Babel plugin for enhanced debug information

## Installation

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/a11ycap.git
cd a11ycap

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Usage

### Browser Library

The core library can be used directly in browsers:

```javascript
// Take an AI-optimized accessibility snapshot
const snapshot = await window.A11yCap.snapshotForAI(document.body, {
  enableReact: true,  // Include React component info
  max_bytes: 4096     // Limit snapshot size
});

// Click an element by its snapshot reference
window.A11yCap.clickRef('e5');  // Clicks element with ref="e5"

// Find element by reference
const element = window.A11yCap.findElementByRef('e5');

// Use the visual element picker
const picker = window.A11yCap.getElementPicker();
const selected = await picker.pick();
console.log('Selected:', selected);
```

### MCP Server

The MCP server enables AI agents to control browsers:

#### Installation with Claude Code

```bash
# Add to Claude Code
claude mcp add -s user -t stdio a11ycap npx a11ycap-mcp
```

#### Local Development

```bash
# Link the package globally for local testing
cd a11ycap-mcp
npm link

# Now you can run it like the published version
a11ycap-mcp

# Or via npx
npx a11ycap-mcp

# To unlink when done testing
npm unlink -g a11ycap-mcp
```

#### Direct Execution

```bash
# Start the MCP server directly
pnpm --filter a11ycap-mcp start

# The server runs on stdio and provides a WebSocket server on port 12456
```

To connect a browser, paste this in the browser console:

```javascript
(async()=>{const s=document.createElement('script');s.src='http://localhost:12456/a11ycap.js';document.head.appendChild(s);await new Promise(r=>s.onload=r);await window.A11yCap.initializeMCPConnection('ws://localhost:12456/browser-ws');console.log('✅ Connected to a11ycap MCP server')})()
```

### Available MCP Tools

Once connected, AI agents can use these tools:

- `take_snapshot` - Capture accessibility snapshot of the page
- `click_element` - Click an element by reference
- `type_text` - Type text into an input field
- `press_key` - Press keyboard keys
- `hover_element` - Hover over elements
- `select_option` - Select dropdown options
- `wait_for` - Wait for conditions
- `execute_js` - Execute JavaScript code
- `get_network_requests` - Get network activity
- `list_tabs` - List connected browser tabs
- `show_element_picker` - Show visual element picker

## Development

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter a11ycap build
pnpm --filter a11ycap-mcp build
```

### Testing

```bash
# Run all tests (Playwright)
pnpm test

# Run tests in headed mode (visible browser)
pnpm test:headed

# Run specific test
pnpm --filter a11ycap build && playwright test test/snapshotForAI.spec.ts
```

### Linting

```bash
# Lint all packages
pnpm lint

# Fix lint issues
pnpm --filter a11ycap run lint:fix
```

### Development Server

```bash
# Start test React app (for manual testing)
cd testpagecra && PORT=14652 BROWSER=none pnpm start

# Run MCP server in dev mode
pnpm --filter a11ycap-mcp dev
```

## API Reference

### Core Functions

#### `snapshotForAI(element, options)`
Generate an AI-optimized accessibility snapshot.

**Parameters:**
- `element` - DOM element to snapshot
- `options` - Configuration object:
  - `enableReact` - Include React component information
  - `refPrefix` - Prefix for element references (default: 'e')
  - `max_bytes` - Maximum snapshot size in bytes

**Returns:** Promise<string> - Formatted accessibility tree

#### `clickRef(ref, element?)`
Click an element by its snapshot reference.

**Parameters:**
- `ref` - Element reference from snapshot (e.g., 'e5')
- `element` - Root element to search within (default: document.body)

**Returns:** boolean - Success status

#### `findElementByRef(ref, element?)`
Find a DOM element by its snapshot reference.

**Parameters:**
- `ref` - Element reference from snapshot
- `element` - Root element to search within

**Returns:** Element | null

### Snapshot Modes

The library supports multiple snapshot modes:

- `'ai'` - Optimized for AI/LLM consumption (default for `snapshotForAI`)
- `'expect'` - For test assertions
- `'codegen'` - For code generation
- `'autoexpect'` - Automatic expectation mode

## Architecture

### Accessibility Tree Generation

The library generates accessibility trees by:
1. Traversing the DOM tree
2. Computing ARIA roles and properties
3. Extracting text content and labels
4. Adding React component information (when available)
5. Assigning unique references to interactive elements

### Size-Limited Rendering

When `max_bytes` is specified, the library uses breadth-first expansion:
1. Start with root node only
2. Add children level by level
3. Stop when size limit is reached
4. Include truncation warning if needed

### React Integration

The library integrates with React DevTools to extract:
- Component names and props
- Component source locations (with babel plugin)
- Component hierarchy information

### MCP Protocol

The MCP server implements:
- Stdio transport for MCP communication
- WebSocket server for browser connections
- Primary/secondary server architecture
- Tool definitions for browser automation

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- No IE 11 support
- Requires ES2015+ features

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass (`pnpm test`)
5. Submit a pull request

## License

Licensed under Apache-2.0 (a11ycap) and MIT (a11ycap-mcp).

## Credits

Based on Playwright's accessibility snapshot functionality by Microsoft Corporation.