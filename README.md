# a11ycap

AI-focused accessibility snapshot library and MCP server for web automation. Inject into any webpage to enable AI agents to see and interact with page content through accessibility snapshots.

## 🚀 Quick Start

### Browser Injection (Recommended)

After installing the MCP server, inject a11ycap into any webpage by pasting this script in the browser console:

```javascript
(async()=>{const s=document.createElement('script');s.src='http://localhost:12456/a11ycap.js';document.head.appendChild(s);await new Promise(r=>s.onload=r);await window.A11yCap.initializeMCPConnection('ws://localhost:12456/browser-ws');console.log('✅ Connected to a11ycap MCP server')})()
```

This gives AI agents immediate access to:
- 🔍 **Take accessibility snapshots** of any page
- 🖱️ **Click and interact** with page elements
- ⌨️ **Type text and navigate** through forms
- 🤖 **Execute JavaScript** for complex interactions
- 📊 **Analyze accessibility** with comprehensive WCAG auditing

### MCP Server Setup

Install and start the MCP server for AI agent integration:

```bash
# Add to Claude Code
claude mcp add -s user -t stdio a11ycap npx a11ycap-mcp

# Or run directly
npx a11ycap-mcp
```

The server provides a WebSocket endpoint on port 12456 for browser connections.

## 🛠️ Available Tools

Once connected, AI agents have access to these powerful tools:

### 📸 Analysis & Inspection
- **`take_snapshot`** - Capture AI-optimized accessibility snapshots
- **`doctor`** - Comprehensive WCAG accessibility analysis with axe-core
- **`get_element_info`** - Detailed element information and properties
- **`get_readability`** - Extract clean article content using Mozilla Readability
- **`list_tabs`** - List all connected browser tabs

### 🖱️ User Interaction
- **`click_element`** - Click elements using snapshot references
- **`type_text`** - Type text into input fields
- **`press_key`** - Press individual keyboard keys
- **`press_key_global`** - Press keys globally (document-level)
- **`hover_element`** - Hover over elements
- **`select_option`** - Select dropdown options

### 🔧 Advanced Tools
- **`execute_js`** - Execute JavaScript code (IIFE format required)
- **`wait_for`** - Wait for text appearance/disappearance or CSS selectors
- **`show_element_picker`** - Visual element selection overlay
- **`get_picked_elements`** - Retrieve visually selected elements
- **`mutate_element`** - Modify element attributes, styles, and content

### 📊 Monitoring & Debugging
- **`get_network_requests`** - Monitor network activity via Performance API
- **`get_console_logs`** - Retrieve browser console messages
- **`get_user_interactions`** - Get recorded user interaction events
- **`capture_element_image`** - Take PNG screenshots of specific elements

## ✨ Key Features

### 🤖 AI-Optimized Snapshots
Generate accessibility trees specifically designed for AI/LLM consumption with React component information and size-limited rendering.

### 🎯 Element Targeting
Multiple ways to target elements:
- **Element refs** - From accessibility snapshots (e.g., "e5", "e7")
- **CSS selectors** - Standard CSS selectors
- **Bounding boxes** - Target elements within viewport areas
- **Visual picker** - Interactive element selection

### ⚛️ React DevTools Integration
Extract React component information including:
- Component names and props
- Component source locations
- Component hierarchy
- State information

### 🔍 Comprehensive Accessibility Analysis
The **doctor tool** provides:
- **WCAG 2.1 AA/AAA compliance** checking with axe-core
- **Severity filtering** (critical, serious, moderate, minor)
- **Configuration presets** (wcag-aa, wcag-aaa, section508, best-practice)
- **Smart recommendations** based on violation patterns
- **User impact analysis** (screen reader, keyboard, low vision users)

## 🌐 Usage Examples

### Basic Snapshot
```javascript
// Take an accessibility snapshot
const snapshot = await window.A11yCap.snapshotForAI(document.body);
console.log(snapshot);
```

### Element Interaction
```javascript
// Click an element by reference from snapshot
window.A11yCap.clickRef('e5');

// Find element by reference
const element = window.A11yCap.findElementByRef('e5');
```

### Accessibility Analysis
```javascript
// Comprehensive WCAG analysis
const toolHandler = window.A11yCap.toolHandlers['doctor'];
const analysis = await toolHandler.execute({
  id: 'accessibility-audit',
  type: 'doctor',
  payload: {
    preset: 'wcag-aa',  // Use WCAG AA preset
    includeElementInfo: true
  }
});
```

### Visual Element Picker
```javascript
// Interactive element selection
const picker = window.A11yCap.getElementPicker();
const selected = await picker.pick();
console.log('Selected elements:', selected);
```

## 🏗️ Project Structure

- **`a11ycap/`** - Core browser-compatible library
- **`a11ycap-mcp/`** - MCP server for AI agent integration
- **`testpagecra/`** - React test application
- **`babel-plugin-a11ycap/`** - Babel plugin for debug info

## 🔧 Installation

```bash
# Install globally
npm install -g a11ycap-mcp

# Or use npx
npx a11ycap-mcp
```

## 🌍 Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2015+ features required
- No IE 11 support

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Credits

Based on Playwright's accessibility snapshot functionality by Microsoft Corporation.
