#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to generate markdown documentation of all MCP tools defined in this repository.
 * Reads tool definitions from the a11ycap library and creates a comprehensive doc file.
 */

// Import the tool definitions from the built library
async function loadToolDefinitions() {
  try {
    // Try importing from the main index file
    const { toolDefinitions } = await import('../a11ycap/dist/index.js');
    return toolDefinitions;
  } catch (error) {
    console.error('Failed to load tool definitions. Make sure the a11ycap library is built.');
    console.error('Error:', error.message);
    console.error('Run: pnpm --filter a11ycap build');
    process.exit(1);
  }
}

function generateMarkdown(toolDefinitions) {
  let markdown = `## Detailed Tool Reference

`;

  // Generate detailed documentation for each tool
  for (const tool of toolDefinitions) {
    markdown += `### ${tool.name}\n\n`;
    markdown += `${tool.description}\n\n`;
    markdown += `---\n\n`;
  }

  return markdown;
}

async function main() {
  const toolDefinitions = await loadToolDefinitions();
  const markdown = generateMarkdown(toolDefinitions);
  
  const outputPath = path.join(__dirname, '..', 'docs', 'mcp-tools.md');
  
  // Ensure docs directory exists
  const docsDir = path.dirname(outputPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Generated MCP tools documentation: ${outputPath}`);
  console.log(`Documented ${toolDefinitions.length} tools`);
}

main().catch(console.error);