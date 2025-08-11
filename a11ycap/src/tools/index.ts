export { takeSnapshotTool, takeSnapshotDefinition } from './takeSnapshot.js';
export { clickElementTool, clickElementDefinition } from './clickElement.js';
export { getNetworkRequestsTool, getNetworkRequestsDefinition } from './getNetworkRequests.js';
export { listTabsTool, listTabsDefinition } from './listTabs.js';
export { executeJsTool, executeJsDefinition } from './executeJs.js';
export { typeTextTool, typeTextDefinition } from './typeText.js';
export { pressKeyTool, pressKeyDefinition } from './pressKey.js';
export { pressKeyGlobalTool, pressKeyGlobalDefinition } from './pressKeyGlobal.js';
export { hoverElementTool, hoverElementDefinition } from './hoverElement.js';
export { selectOptionTool, selectOptionDefinition } from './selectOption.js';
export { waitForTool, waitForDefinition } from './waitFor.js';
export { showElementPickerTool, showElementPickerDefinition } from './showElementPicker.js';
export type { ToolDefinition, ToolHandler, BaseToolMessage } from './base.js';

import { takeSnapshotTool } from './takeSnapshot.js';
import { clickElementTool } from './clickElement.js';
import { getNetworkRequestsTool } from './getNetworkRequests.js';
import { listTabsTool } from './listTabs.js';
import { executeJsTool } from './executeJs.js';
import { typeTextTool } from './typeText.js';
import { pressKeyTool } from './pressKey.js';
import { pressKeyGlobalTool } from './pressKeyGlobal.js';
import { hoverElementTool } from './hoverElement.js';
import { selectOptionTool } from './selectOption.js';
import { waitForTool } from './waitFor.js';
import { showElementPickerTool } from './showElementPicker.js';

export const allTools = [
  takeSnapshotTool,
  clickElementTool,
  getNetworkRequestsTool,
  listTabsTool,
  executeJsTool,
  typeTextTool,
  pressKeyTool,
  pressKeyGlobalTool,
  hoverElementTool,
  selectOptionTool,
  waitForTool,
  showElementPickerTool
];

export const toolDefinitions = allTools.map(tool => tool.definition);
export const toolHandlers = Object.fromEntries(
  allTools.map(tool => [tool.definition.name, tool])
);